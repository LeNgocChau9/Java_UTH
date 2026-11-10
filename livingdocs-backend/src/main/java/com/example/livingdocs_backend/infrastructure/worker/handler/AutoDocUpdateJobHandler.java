package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.dto.drift.AutoDocUpdateJobPayload;
import com.example.livingdocs_backend.application.dto.github.GitHubPrFileDto;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.application.service.GitHubWebhookServiceImpl;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.*;

/**
 * JobHandler thực thi Auto-Update Pipeline ngầm khi nhận được sự kiện commit/push
 * hoặc merge Pull Request từ GitHub Webhook.
 * 
 * Luồng hoạt động:
 * 1. Bóc tách tổng quát các file mã nguồn (Java, TS, TSX, JS, PY, CS, Go, SQL,...) và phương thức bị sửa đổi qua git diff/AST thực tế.
 * 2. Tìm các tài liệu bị ảnh hưởng trong repository qua doc_code_links hoặc cấu trúc tài liệu CSDL.
 * 3. Tự động gọi AI Engine (/v1/docs/rewrite-suggestion) với Google Gemini thực tế để phân tích và viết lại tài liệu.
 * 4. Tự động lưu bản ghi phiên bản mới với actorRole = 'AI_AGENT', triggerType = 'AUTO_DRIFT_AI_REWRITE' và cập nhật hash chain.
 * 5. Cập nhật trạng thái tài liệu sang UNDER_REVIEW_STAFF và đưa thẳng vào hàng đợi xem xét của Nhân viên.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoDocUpdateJobHandler implements JobHandler {

    private final AutoDraftServicePort autoDraftService;
    private final CodeDiffAnalysisServicePort codeDiffAnalysisService;
    private final DocDriftDetectionServicePort docDriftDetectionService;
    private final SpringDataDocumentRepository documentRepository;
    private final SpringDataDocCodeLinkRepository docCodeLinkRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataGitHubConnectionRepository connectionRepository;
    private final GitHubClientPort gitHubClient;
    private final ObjectMapper objectMapper;

    @Override
    public String getJobType() {
        return GitHubWebhookServiceImpl.JOB_TYPE_AUTO_DOC_UPDATE;
    }

    @Override
    public void handle(Job job) throws Exception {
        log.info("[JobHandler - AUTO_DOC_UPDATE] Bắt đầu xử lý Job #{}", job.getJobId());

        if (job.getPayloadJson() == null || job.getPayloadJson().isBlank()) {
            log.warn("[JobHandler - AUTO_DOC_UPDATE] Payload của Job #{} rỗng, bỏ qua.", job.getJobId());
            return;
        }

        AutoDocUpdateJobPayload payload = objectMapper.readValue(job.getPayloadJson(), AutoDocUpdateJobPayload.class);
        log.info("[JobHandler - AUTO_DOC_UPDATE] Thực thi pipeline cho repo [{}] (Head: {}, Tác giả: {})",
                payload.getRepoFullName(), payload.getHeadCommitSha(), payload.getCommitAuthor());

        RepositoryEntity repo = repositoryRepository.findById(payload.getRepositoryId()).orElse(null);
        if (repo == null) {
            log.warn("[JobHandler - AUTO_DOC_UPDATE] Không tìm thấy repository với ID: {}, bỏ qua.", payload.getRepositoryId());
            return;
        }

        String token = resolveGitHubToken(repo);
        String[] parts = repo.getRepoFullName() != null ? repo.getRepoFullName().split("/") : new String[0];
        String owner = parts.length == 2 ? parts[0] : "";
        String repoName = parts.length == 2 ? parts[1] : "";

        // 1. Kéo thông tin chi tiết commit và danh sách file kèm patch thực tế từ GitHub API nếu có token
        List<GitHubPrFileDto> commitFiles = Collections.emptyList();
        if (gitHubClient != null && StringUtils.hasText(token) && StringUtils.hasText(owner)) {
            try {
                commitFiles = gitHubClient.getCommitFiles(token, owner, repoName, payload.getHeadCommitSha());
            } catch (Exception ex) {
                log.warn("[JobHandler - AUTO_DOC_UPDATE] Không lấy được commit files từ GitHub: {}", ex.getMessage());
            }
        }

        // Tập hợp danh sách file thay đổi tổng quát
        List<String> targetFiles = new ArrayList<>();
        Map<String, String> filePatches = new HashMap<>();

        if (commitFiles != null && !commitFiles.isEmpty()) {
            for (GitHubPrFileDto cf : commitFiles) {
                if (cf.filename() != null && isTextOrSourceFile(cf.filename())) {
                    targetFiles.add(cf.filename());
                    if (StringUtils.hasText(cf.patch())) {
                        filePatches.put(cf.filename(), cf.patch());
                    }
                }
            }
        }

        // Bổ sung file từ payload nếu chưa có
        if (payload.getChangedFiles() != null) {
            for (String f : payload.getChangedFiles()) {
                if (f != null && isTextOrSourceFile(f) && !targetFiles.contains(f)) {
                    targetFiles.add(f);
                }
            }
        }

        if (targetFiles.isEmpty()) {
            log.info("[JobHandler - AUTO_DOC_UPDATE] Không có file mã nguồn nào bị thay đổi cần cập nhật.");
            return;
        }

        // 2. Chuẩn bị danh sách file diff để đối chiếu AST / Phân tích thay đổi
        List<AstDiffRequestDto.FileDiffItemDto> fileDiffItems = new ArrayList<>();
        for (String filePath : targetFiles) {
            String baseCode = "";
            String headCode = "";

            if (gitHubClient != null && StringUtils.hasText(token) && StringUtils.hasText(owner)) {
                try {
                    baseCode = gitHubClient.getFileContent(token, owner, repoName, filePath, payload.getBaseCommitSha());
                    headCode = gitHubClient.getFileContent(token, owner, repoName, filePath, payload.getHeadCommitSha());
                } catch (Exception ex) {
                    log.warn("[JobHandler - AUTO_DOC_UPDATE] Không lấy được nội dung file '{}' từ GitHub: {}", filePath, ex.getMessage());
                }
            }

            if (!StringUtils.hasText(headCode)) {
                if (filePatches.containsKey(filePath)) {
                    headCode = filePatches.get(filePath);
                } else if (StringUtils.hasText(payload.getDiffContent())) {
                    headCode = payload.getDiffContent();
                }
            }

            fileDiffItems.add(AstDiffRequestDto.FileDiffItemDto.builder()
                    .file_path(filePath)
                    .base_code(baseCode != null ? baseCode : "")
                    .head_code(headCode != null ? headCode : "")
                    .build());
        }

        AstDiffRequestDto diffRequest = AstDiffRequestDto.builder()
                .repository_id(payload.getRepositoryId())
                .base_commit_hash(payload.getBaseCommitSha())
                .head_commit_hash(payload.getHeadCommitSha())
                .files(fileDiffItems)
                .build();

        // 3. Tìm các tài liệu bị ảnh hưởng trong repository
        Map<Long, List<AffectedDocumentResultDto>> docToChanges = new LinkedHashMap<>();

        // 3.1. Đối chiếu qua AST / Drift Detection
        try {
            List<AffectedDocumentResultDto> affectedDocs = docDriftDetectionService.findAffectedDocuments(payload.getRepositoryId(), diffRequest);
            for (AffectedDocumentResultDto item : affectedDocs) {
                if (item.documentId() != null) {
                    docToChanges.computeIfAbsent(item.documentId(), k -> new ArrayList<>()).add(item);
                }
            }
        } catch (Exception ex) {
            log.warn("[JobHandler - AUTO_DOC_UPDATE] Lỗi phân tích AST, tiếp tục với liên kết CSDL: {}", ex.getMessage());
        }

        // 3.2. Tra cứu trực tiếp bảng doc_code_links thực tế theo đường dẫn file
        if (docCodeLinkRepository != null) {
            for (String filePath : targetFiles) {
                List<DocCodeLinkEntity> links = docCodeLinkRepository.findByFilePath(filePath);
                for (DocCodeLinkEntity link : links) {
                    docToChanges.computeIfAbsent(link.getDocumentId(), k -> new ArrayList<>());
                }
            }
        }

        // 3.3. Tra cứu theo targetPath hoặc tiêu đề tài liệu trong repository
        List<DocumentEntity> existingDocs = documentRepository.findByRepoId(payload.getRepositoryId());
        if (!existingDocs.isEmpty()) {
            for (DocumentEntity d : existingDocs) {
                for (String filePath : targetFiles) {
                    String baseName = extractBaseName(filePath);
                    if ((d.getTargetPath() != null && d.getTargetPath().contains(baseName))
                            || (d.getTitle() != null && d.getTitle().toLowerCase().contains(baseName.toLowerCase()))) {
                        docToChanges.computeIfAbsent(d.getDocId(), k -> new ArrayList<>());
                    }
                }
            }
        }

        // Fallback: Nếu chưa tìm thấy tài liệu cụ thể, cập nhật tài liệu đầu tiên trong repo
        if (docToChanges.isEmpty() && !existingDocs.isEmpty()) {
            DocumentEntity primaryDoc = existingDocs.get(0);
            docToChanges.put(primaryDoc.getDocId(), Collections.emptyList());
        }

        if (docToChanges.isEmpty()) {
            // Tạo tài liệu kỹ thuật khởi tạo cho repository nếu chưa có bất kỳ tài liệu nào
            String sampleName = extractBaseName(targetFiles.get(0));
            DocumentEntity autoDoc = DocumentEntity.builder()
                    .repoId(payload.getRepositoryId())
                    .title("Tài liệu kỹ thuật " + sampleName)
                    .targetPath("docs/" + sampleName + ".md")
                    .status(DocumentStatus.UNDER_REVIEW_STAFF)
                    .currentVersion(1)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            autoDoc = documentRepository.save(autoDoc);
            docToChanges.put(autoDoc.getDocId(), Collections.emptyList());
        }

        // 4. Với từng tài liệu bị ảnh hưởng: xây dựng Git Diff thực tế và gọi AI Engine viết lại
        int updatedCount = 0;
        for (Map.Entry<Long, List<AffectedDocumentResultDto>> entry : docToChanges.entrySet()) {
            Long docId = entry.getKey();
            List<AffectedDocumentResultDto> changes = entry.getValue();

            StringBuilder diffBuilder = new StringBuilder();
            diffBuilder.append("Commit SHA: ").append(payload.getHeadCommitSha()).append("\n");
            diffBuilder.append("Tác giả commit: ").append(payload.getCommitAuthor()).append("\n");
            diffBuilder.append("Thông điệp commit: ").append(payload.getCommitMessage()).append("\n");

            // Bổ sung các patch thực tế từ git commit
            if (!filePatches.isEmpty()) {
                diffBuilder.append("\n--- Git Patch Thay đổi Thực tế ---\n");
                for (Map.Entry<String, String> p : filePatches.entrySet()) {
                    diffBuilder.append("File: ").append(p.getKey()).append("\n");
                    diffBuilder.append(p.getValue()).append("\n\n");
                }
            } else if (changes != null && !changes.isEmpty()) {
                diffBuilder.append("\nCác thành phần mã nguồn bị ảnh hưởng:\n");
                for (AffectedDocumentResultDto c : changes) {
                    diffBuilder.append("- File: ").append(c.relatedFilePath())
                            .append(", Thành phần: ").append(c.methodName())
                            .append(" (").append(c.changeType()).append("): ")
                            .append(c.details() != null ? c.details() : "Cập nhật mã nguồn")
                            .append("\n");
                }
            } else {
                diffBuilder.append("Các file mã nguồn thay đổi: ").append(String.join(", ", targetFiles)).append("\n");
                if (StringUtils.hasText(payload.getDiffContent())) {
                    diffBuilder.append("Chi tiết Diff:\n").append(payload.getDiffContent()).append("\n");
                }
            }

            String summaryReason = "khi mã nguồn commit " + payload.getHeadCommitSha() + " thay đổi (" + payload.getCommitMessage() + ")";

            autoDraftService.generateAutoDraftForDocument(
                    docId,
                    diffBuilder.toString(),
                    payload.getHeadCommitSha(),
                    summaryReason,
                    null
            );
            updatedCount++;
        }

        log.info("[JobHandler - AUTO_DOC_UPDATE] Đã hoàn tất Auto-Update Pipeline cho {} tài liệu trong repo [{}]",
                updatedCount, repo.getRepoFullName());
    }

    private boolean isTextOrSourceFile(String filename) {
        if (!StringUtils.hasText(filename)) return false;
        String lower = filename.toLowerCase();
        return !(lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                || lower.endsWith(".gif") || lower.endsWith(".ico") || lower.endsWith(".svg")
                || lower.endsWith(".pdf") || lower.endsWith(".zip") || lower.endsWith(".tar")
                || lower.endsWith(".gz") || lower.endsWith(".jar") || lower.endsWith(".war")
                || lower.endsWith(".exe") || lower.endsWith(".bin") || lower.endsWith(".dll")
                || lower.endsWith(".so") || lower.endsWith(".dylib") || lower.endsWith(".class"));
    }

    private String extractBaseName(String filePath) {
        if (!StringUtils.hasText(filePath)) return "Unknown";
        String clean = filePath.replace("\\", "/");
        int lastSlash = clean.lastIndexOf('/');
        String filename = lastSlash >= 0 ? clean.substring(lastSlash + 1) : clean;
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private String resolveGitHubToken(RepositoryEntity repo) {
        if (connectionRepository != null && repo.getConnectionId() != null) {
            Optional<GitHubConnectionEntity> connOpt = connectionRepository.findById(repo.getConnectionId());
            if (connOpt.isPresent() && connOpt.get().getAccessTokenEncrypted() != null) {
                return connOpt.get().getAccessTokenEncrypted();
            }
        }
        return System.getenv("GITHUB_TOKEN");
    }
}
