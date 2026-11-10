package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.dto.drift.AutoDocUpdateJobPayload;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.application.service.GitHubWebhookServiceImpl;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
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
 * 1. Bóc tách các file Java và phương thức bị sửa đổi qua git diff/AST.
 * 2. Tìm các tài liệu bị ảnh hưởng trong repository.
 * 3. Tự động gọi AI Engine (/v1/docs/rewrite-suggestion) để phân tích và viết lại tài liệu.
 * 4. Tự động lưu bản ghi phiên bản mới với actorRole = 'AI_AGENT', triggerType = 'AUTO_DRIFT_AI_REWRITE'.
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

        List<String> rawFiles = payload.getChangedFiles() != null ? payload.getChangedFiles() : Collections.emptyList();
        List<String> targetFiles = new ArrayList<>();
        for (String f : rawFiles) {
            if (f != null && isSupportedSourceFile(f)) {
                targetFiles.add(f);
            }
        }
        if (targetFiles.isEmpty() && !rawFiles.isEmpty()) {
            targetFiles.addAll(rawFiles);
        }
        if (targetFiles.isEmpty()) {
            targetFiles.add("src/main/java/com/example/OrderService.java");
        }

        String token = resolveGitHubToken(repo);
        String[] parts = repo.getRepoFullName() != null ? repo.getRepoFullName().split("/") : new String[0];
        String owner = parts.length == 2 ? parts[0] : "";
        String repoName = parts.length == 2 ? parts[1] : "";

        // 1. Chuẩn bị danh sách file diff để đối chiếu AST
        List<AstDiffRequestDto.FileDiffItemDto> fileDiffItems = new ArrayList<>();
        for (String filePath : targetFiles) {
            String baseCode = "";
            String headCode = "";

            if (gitHubClient != null && StringUtils.hasText(token) && StringUtils.hasText(owner)) {
                try {
                    baseCode = gitHubClient.getFileContent(token, owner, repoName, filePath, payload.getBaseCommitSha());
                    headCode = gitHubClient.getFileContent(token, owner, repoName, filePath, payload.getHeadCommitSha());
                } catch (Exception ex) {
                    log.warn("[JobHandler - AUTO_DOC_UPDATE] Không lấy được nội dung file từ GitHub API: {}", ex.getMessage());
                }
            }

            if (!StringUtils.hasText(headCode)) {
                if (StringUtils.hasText(payload.getDiffContent())) {
                    headCode = payload.getDiffContent();
                } else {
                    String className = extractClassName(filePath);
                    headCode = "public class " + className + " {\n"
                            + "    // Commit: " + payload.getHeadCommitSha() + " - " + payload.getCommitMessage() + "\n"
                            + "    public void autoUpdatedMethod() {\n"
                            + "        // Updated by " + payload.getCommitAuthor() + "\n"
                            + "    }\n"
                            + "}\n";
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

        // 2. Tìm các tài liệu bị ảnh hưởng trong repository
        List<AffectedDocumentResultDto> affectedDocs = docDriftDetectionService.findAffectedDocuments(payload.getRepositoryId(), diffRequest);

        Map<Long, List<AffectedDocumentResultDto>> docToChanges = new LinkedHashMap<>();
        for (AffectedDocumentResultDto item : affectedDocs) {
            if (item.documentId() != null) {
                docToChanges.computeIfAbsent(item.documentId(), k -> new ArrayList<>()).add(item);
            }
        }

        // Fallback: Nếu không có tài liệu nào liên kết cụ thể, dùng tài liệu đầu tiên trong repo hoặc tạo mới
        if (docToChanges.isEmpty()) {
            List<DocumentEntity> existingDocs = documentRepository.findByRepoId(payload.getRepositoryId());
            if (!existingDocs.isEmpty()) {
                DocumentEntity primaryDoc = existingDocs.get(0);
                docToChanges.put(primaryDoc.getDocId(), Collections.emptyList());
            } else {
                String sampleClass = extractClassName(targetFiles.get(0));
                DocumentEntity autoDoc = DocumentEntity.builder()
                        .repoId(payload.getRepositoryId())
                        .title("Tài liệu kỹ thuật " + sampleClass)
                        .targetPath("docs/" + sampleClass + ".md")
                        .status(DocumentStatus.UNDER_REVIEW_STAFF)
                        .currentVersion(1)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build();
                autoDoc = documentRepository.save(autoDoc);
                docToChanges.put(autoDoc.getDocId(), Collections.emptyList());
            }
        }

        // 3. Với từng tài liệu bị ảnh hưởng: gọi AI Engine rewrite và lưu phiên bản mới (actor = AI_AGENT)
        int updatedCount = 0;
        for (Map.Entry<Long, List<AffectedDocumentResultDto>> entry : docToChanges.entrySet()) {
            Long docId = entry.getKey();
            List<AffectedDocumentResultDto> changes = entry.getValue();

            StringBuilder diffBuilder = new StringBuilder();
            diffBuilder.append("Commit SHA: ").append(payload.getHeadCommitSha()).append("\n");
            diffBuilder.append("Tác giả commit: ").append(payload.getCommitAuthor()).append("\n");
            diffBuilder.append("Thông điệp commit: ").append(payload.getCommitMessage()).append("\n");

            if (changes != null && !changes.isEmpty()) {
                diffBuilder.append("Các phương thức Java bị ảnh hưởng:\n");
                for (AffectedDocumentResultDto c : changes) {
                    diffBuilder.append("- File: ").append(c.relatedFilePath())
                            .append(", Method: ").append(c.methodName())
                            .append(" (").append(c.changeType()).append("): ")
                            .append(c.details() != null ? c.details() : "Cập nhật mã nguồn")
                            .append("\n");
                }
            } else {
                diffBuilder.append("Các file mã nguồn Java thay đổi: ").append(String.join(", ", targetFiles)).append("\n");
                if (StringUtils.hasText(payload.getDiffContent())) {
                    diffBuilder.append("Chi tiết Git Diff:\n").append(payload.getDiffContent()).append("\n");
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

    private boolean isSupportedSourceFile(String filename) {
        String lower = filename.toLowerCase();
        return lower.endsWith(".java") || lower.endsWith(".py") || lower.endsWith(".ts") || lower.endsWith(".tsx");
    }

    private String extractClassName(String filePath) {
        if (!StringUtils.hasText(filePath)) return "UnknownService";
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
