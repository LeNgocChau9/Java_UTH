package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AiDriftAnalyzeRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDriftAnalyzeResponseDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.*;
import com.example.livingdocs_backend.infrastructure.persistence.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;

/**
 * Service thực thi thuật toán:
 * 1. Tìm tài liệu bị ảnh hưởng qua bảng doc_code_links khi các hàm/class Java thay đổi.
 * 2. Phân tích ngữ nghĩa Drift sâu hơn qua AI Engine (/v1/drift/analyze) dùng Google Gemini.
 * 3. Tạo bản ghi vào bảng document_change_alerts (drift_alerts) với các mức độ nghiêm trọng chính xác từ AI.
 * 4. Tự động comment cảnh báo sai lệch trực tiếp lên Pull Request qua GitHub REST API.
 */
@Slf4j
@Service
public class DocDriftDetectionService implements DocDriftDetectionServicePort {

    private final CodeDiffAnalysisServicePort codeDiffAnalysisService;
    private final SpringDataDocCodeLinkRepository docCodeLinkRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final SpringDataDocumentVersionRepository documentVersionRepository;
    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataPullRequestRepository pullRequestRepository;
    private final SpringDataGitHubConnectionRepository connectionRepository;
    private final GitHubClientPort gitHubClient;
    private final RestClient restClient;

    @Autowired
    public DocDriftDetectionService(
            CodeDiffAnalysisServicePort codeDiffAnalysisService,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentVersionRepository documentVersionRepository,
            SpringDataDocumentChangeAlertRepository alertRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataPullRequestRepository pullRequestRepository,
            SpringDataGitHubConnectionRepository connectionRepository,
            GitHubClientPort gitHubClient,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl
    ) {
        this.codeDiffAnalysisService = codeDiffAnalysisService;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.alertRepository = alertRepository;
        this.repositoryRepository = repositoryRepository;
        this.pullRequestRepository = pullRequestRepository;
        this.connectionRepository = connectionRepository;
        this.gitHubClient = gitHubClient;
        this.restClient = RestClient.builder().baseUrl(aiEngineUrl).build();
    }

    public DocDriftDetectionService(
            CodeDiffAnalysisServicePort codeDiffAnalysisService,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentChangeAlertRepository alertRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataPullRequestRepository pullRequestRepository,
            SpringDataGitHubConnectionRepository connectionRepository,
            GitHubClientPort gitHubClient
    ) {
        this(codeDiffAnalysisService, docCodeLinkRepository, documentRepository, null,
                alertRepository, repositoryRepository, pullRequestRepository, connectionRepository, gitHubClient, "http://localhost:8000");
    }

    @Override
    public List<AffectedDocumentResultDto> findAffectedDocuments(Long repositoryId, AstDiffRequestDto diffRequest) {
        log.info("[DocDrift] Bắt đầu tìm tài liệu bị ảnh hưởng cho repo={}", repositoryId);

        AstDiffResponseDto diffResponse = codeDiffAnalysisService.analyzeAstDiff(diffRequest);
        if (diffResponse == null || diffResponse.files() == null || diffResponse.files().isEmpty()) {
            return Collections.emptyList();
        }

        List<AffectedDocumentResultDto> affectedDocs = new ArrayList<>();
        Set<String> seenDocEntityKeys = new HashSet<>();

        for (AstDiffResponseDto.FileDiffResultDto fileRes : diffResponse.files()) {
            String filePath = fileRes.file_path();
            String className = fileRes.class_name();

            for (AstDiffResponseDto.AffectedEntityItemDto entity : fileRes.affected_entities()) {
                String methodName = entity.method_name();
                String changeType = entity.change_type();
                String severity = entity.impact_level() != null ? entity.impact_level() : "MEDIUM";
                String details = entity.details();

                // 1. Tìm doc_code_links khớp chính xác file_path + methodName hoặc className
                List<DocCodeLinkEntity> matchedLinks = docCodeLinkRepository.findMatchingLinks(filePath, className, methodName);

                // Nếu không có link khớp method, tìm link liên kết ở cấp độ file/class
                if (matchedLinks.isEmpty()) {
                    matchedLinks = docCodeLinkRepository.findMatchingLinks(filePath, className, null);
                }

                // Nếu vẫn chưa có trong doc_code_links, fallback tìm document theo target_path hoặc title liên quan
                if (matchedLinks.isEmpty()) {
                    List<DocumentEntity> directDocs = documentRepository.findByRepoId(repositoryId);
                    for (DocumentEntity d : directDocs) {
                        if (isDocumentRelatedToPath(d, filePath, className)) {
                            String key = d.getDocId() + ":" + methodName;
                            if (seenDocEntityKeys.add(key)) {
                                affectedDocs.add(AffectedDocumentResultDto.builder()
                                        .documentId(d.getDocId())
                                        .documentTitle(d.getTitle())
                                        .documentPath(d.getTargetPath())
                                        .relatedFilePath(filePath)
                                        .className(className)
                                        .methodName(methodName)
                                        .changeType(changeType)
                                        .severity(severity)
                                        .details(details)
                                        .build());
                            }
                        }
                    }
                } else {
                    for (DocCodeLinkEntity link : matchedLinks) {
                        String key = link.getDocumentId() + ":" + methodName;
                        if (seenDocEntityKeys.add(key)) {
                            Optional<DocumentEntity> docOpt = documentRepository.findById(link.getDocumentId());
                            String title = docOpt.map(DocumentEntity::getTitle).orElse("Tài liệu #" + link.getDocumentId());
                            String targetPath = docOpt.map(DocumentEntity::getTargetPath).orElse(link.getFilePath());

                            affectedDocs.add(AffectedDocumentResultDto.builder()
                                    .documentId(link.getDocumentId())
                                    .documentTitle(title)
                                    .documentPath(targetPath)
                                    .relatedFilePath(filePath)
                                    .className(className)
                                    .methodName(methodName)
                                    .changeType(changeType)
                                    .severity(severity)
                                    .details(details)
                                    .build());
                        }
                    }
                }
            }
        }

        log.info("[DocDrift] Tìm thấy {} liên kết tài liệu bị ảnh hưởng bởi thay đổi code.", affectedDocs.size());
        return affectedDocs;
    }

    @Override
    @Transactional
    public PrDriftAnalysisResultDto detectDriftAndCommentOnPr(Long repositoryId, int prNumber, AstDiffRequestDto diffRequest) {
        log.info("[DocDrift] Khởi chạy quy trình phát hiện sai lệch và comment lên PR #{} (repo={})", prNumber, repositoryId);

        RepositoryEntity repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy repository ID: " + repositoryId));

        // 1. Tìm các tài liệu bị ảnh hưởng thông qua AST và doc_code_links
        List<AffectedDocumentResultDto> affectedDocs = findAffectedDocuments(repositoryId, diffRequest);

        // 2. Lấy thông tin PR Entity nếu có
        Optional<PullRequestEntity> prOpt = pullRequestRepository.findByRepositoryIdAndPrNumber(repositoryId, prNumber);
        Long prId = prOpt.map(PullRequestEntity::getPrId).orElse(null);

        // 3. Tạo bản ghi vào bảng document_change_alerts (drift_alerts) với phân tích AI ngữ nghĩa nếu có
        Instant now = Instant.now();
        List<DocumentChangeAlertEntity> savedAlerts = new ArrayList<>();

        for (AffectedDocumentResultDto item : affectedDocs) {
            String classification = switch (item.changeType()) {
                case "DELETED", "RENAMED" -> "REFERENCE";
                case "PARAM_CHANGED", "RETURN_TYPE_CHANGED", "SIGNATURE_CHANGED" -> "SIGNATURE";
                default -> "SEMANTIC";
            };

            String severity = item.severity();
            String details = String.format("Tài liệu '%s' bị ảnh hưởng do hàm '%s' (%s) tại '%s': %s",
                    item.documentTitle(), item.methodName(), item.changeType(), item.relatedFilePath(), item.details());

            // Gọi AI Semantic Drift (/v1/drift/analyze) để đánh giá ngữ nghĩa chuyên sâu bằng Gemini
            AiDriftAnalyzeResponseDto aiDrift = analyzeDriftWithAi(item, diffRequest, prNumber, repositoryId);
            if (aiDrift != null && aiDrift.getSeverity() != null) {
                severity = aiDrift.getSeverity();
                if (aiDrift.getClassification() != null) {
                    classification = aiDrift.getClassification();
                }
                if (aiDrift.getExplanation() != null && !aiDrift.getExplanation().isBlank()) {
                    details = String.format("[%s] %s | AI Giải thích: %s",
                            aiDrift.getSeverity(), details, aiDrift.getExplanation());
                }
            }

            DocumentChangeAlertEntity alert = DocumentChangeAlertEntity.builder()
                    .repositoryId(repositoryId)
                    .documentId(item.documentId())
                    .sourcePrId(prId)
                    .sourceCommit(diffRequest.head_commit_hash())
                    .classification(classification)
                    .severity(severity)
                    .status("OPEN")
                    .details(details)
                    .createdAt(now)
                    .build();

            savedAlerts.add(alert);
        }

        if (!savedAlerts.isEmpty()) {
            alertRepository.saveAll(savedAlerts);
            log.info("[DocDrift] Đã lưu {} bản ghi vào bảng document_change_alerts", savedAlerts.size());
        }

        // 4. Định dạng Markdown comment chi tiết và chuyên nghiệp
        String commentMarkdown = buildPrDriftCommentMarkdown(prNumber, affectedDocs, diffRequest);

        // 5. Gọi GitHub REST API đăng comment lên PR
        Long commentId = null;
        String repoFullName = repo.getRepoFullName();
        String commentUrl = null;

        try {
            String token = resolveGitHubToken(repo);
            String[] parts = repoFullName.split("/");
            if (parts.length == 2 && token != null) {
                String owner = parts[0];
                String repoName = parts[1];
                commentId = gitHubClient.createPullRequestComment(token, owner, repoName, prNumber, commentMarkdown);
                commentUrl = String.format("https://github.com/%s/pull/%d#issuecomment-%s", repoFullName, prNumber, commentId != null ? commentId : "latest");
                log.info("[DocDrift] Đã đăng comment cảnh báo lên PR #{} thành công! CommentId={}", prNumber, commentId);
            } else {
                log.warn("[DocDrift] Không có GitHub Token hợp lệ hoặc tên repo sai ({}), bỏ qua gửi HTTP request trực tiếp.", repoFullName);
            }
        } catch (Exception ex) {
            log.error("[DocDrift] Không thể đăng comment lên GitHub PR #{}: {}", prNumber, ex.getMessage(), ex);
        }

        return PrDriftAnalysisResultDto.builder()
                .repositoryId(repositoryId)
                .prNumber(prNumber)
                .repoFullName(repoFullName)
                .totalChangesDetected(diffRequest.files() != null ? diffRequest.files().size() : 0)
                .totalAffectedDocs(affectedDocs.size())
                .affectedDocuments(affectedDocs)
                .commentId(commentId)
                .commentUrl(commentUrl)
                .status("SUCCESS")
                .message("Phát hiện " + affectedDocs.size() + " tài liệu bị ảnh hưởng. Đã đăng cảnh báo lên PR #" + prNumber)
                .build();
    }

    /**
     * Gọi AI Engine (/v1/drift/analyze) để phân tích sai lệch ngữ nghĩa qua Gemini.
     */
    private AiDriftAnalyzeResponseDto analyzeDriftWithAi(AffectedDocumentResultDto item, AstDiffRequestDto diffRequest, int prNumber, Long repositoryId) {
        try {
            String currentDoc = "";
            if (documentVersionRepository != null && item.documentId() != null) {
                currentDoc = documentVersionRepository.findTopByDocIdOrderByVersionNumDesc(item.documentId())
                        .map(DocumentVersionEntity::getContent)
                        .orElse("");
            }

            String diffSnippet = item.details() != null ? item.details() : "Diff for method: " + item.methodName();

            AiDriftAnalyzeRequestDto request = AiDriftAnalyzeRequestDto.builder()
                    .code_diff(diffSnippet)
                    .current_doc(currentDoc)
                    .entity_name(item.methodName() != null ? item.methodName() : item.className())
                    .entity_type("METHOD")
                    .file_path(item.relatedFilePath())
                    .document_id(item.documentId())
                    .repository_id(repositoryId)
                    .pr_number(prNumber)
                    .commit_hash(diffRequest.head_commit_hash())
                    .build();

            return restClient.post()
                    .uri("/v1/drift/analyze")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiDriftAnalyzeResponseDto.class);
        } catch (Exception ex) {
            log.warn("[DocDrift] Bỏ qua AI semantic drift cho docId={} do: {}", item.documentId(), ex.getMessage());
            return null;
        }
    }

    private String buildPrDriftCommentMarkdown(int prNumber, List<AffectedDocumentResultDto> affectedDocs, AstDiffRequestDto diffRequest) {
        StringBuilder sb = new StringBuilder();
        sb.append("##  LivingDocs — Cảnh Báo Trôi Dạt Tài Liệu (Documentation Drift Alert)\n\n");
        sb.append(String.format("Phân tích AST tự động cho **Pull Request #%d** (Commit: `%s`):\n\n",
                prNumber, diffRequest.head_commit_hash() != null ? diffRequest.head_commit_hash() : "HEAD"));

        if (affectedDocs.isEmpty()) {
            sb.append(" **Không phát hiện sự sai lệch tài liệu nào!** Các hàm được thêm mới hoặc giữ nguyên chữ ký tương thích với tài liệu hiện tại.\n\n");
            sb.append("> *Hệ thống LivingDocs tự động giám sát và bảo vệ tính nhất quán của tài liệu dự án.*");
            return sb.toString();
        }

        sb.append(String.format(">  **Phát hiện %d tài liệu bị ảnh hưởng** cần cập nhật do mã nguồn đã thay đổi chữ ký, bị xóa hoặc đổi tên:\n\n", affectedDocs.size()));
        sb.append("| Mức độ | Tài liệu liên kết | Hàm thay đổi | Loại thay đổi | Chi tiết |\n");
        sb.append("| :--- | :--- | :--- | :--- | :--- |\n");

        for (AffectedDocumentResultDto item : affectedDocs) {
            String badge = switch (item.severity()) {
                case "CRITICAL" -> " **CRITICAL**";
                case "HIGH" -> " **HIGH**";
                case "MEDIUM" -> " **MEDIUM**";
                default -> "ℹ **LOW**";
            };

            sb.append(String.format("| %s | `%s` | `%s` | `%s` | %s |\n",
                    badge, item.documentTitle(), item.methodName(), item.changeType(), item.details()));
        }

        sb.append("\n###  Hành động đề xuất cho Developer & Reviewer:\n");
        sb.append("1. Kiểm tra lại các tài liệu kỹ thuật được liệt kê ở trên trước khi tiến hành **Merge** Pull Request.\n");
        sb.append("2. Truy cập LivingDocs Dashboard để xem đề xuất cập nhật tự động bằng AI (Auto-Update Document).\n\n");
        sb.append("---\n*Automated by LivingDocs CI/CD Bot*");

        return sb.toString();
    }

    private boolean isDocumentRelatedToPath(DocumentEntity doc, String filePath, String className) {
        if (doc.getTargetPath() != null && doc.getTargetPath().contains(filePath)) {
            return true;
        }
        if (className != null && doc.getTitle() != null && doc.getTitle().toLowerCase().contains(className.toLowerCase())) {
            return true;
        }
        return false;
    }

    private String resolveGitHubToken(RepositoryEntity repo) {
        if (repo.getConnectionId() != null) {
            Optional<GitHubConnectionEntity> connOpt = connectionRepository.findById(repo.getConnectionId());
            if (connOpt.isPresent() && connOpt.get().getAccessTokenEncrypted() != null) {
                return connOpt.get().getAccessTokenEncrypted();
            }
        }
        return System.getenv("GITHUB_TOKEN");
    }
}
