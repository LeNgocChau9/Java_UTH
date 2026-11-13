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
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;

/**
 * Service thực thi nghiệp vụ:
 * 1. Kéo Git Diff thời gian thực từ GitHub và đối chiếu AST.
 * 2. Tìm tài liệu bị ảnh hưởng qua bảng doc_code_links khi các hàm/class
 * (.java, .py, .ts) thay đổi.
 * 3. Phân loại mức độ nghiêm trọng (Critical/High/Medium/Low).
 * 4. Phân tích ngữ nghĩa Drift sâu hơn qua AI Engine (/v1/drift/analyze) dùng
 * Google Gemini.
 * 5. Tạo bản ghi vào bảng document_change_alerts và tự động comment cảnh báo
 * lên Pull Request.
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
    private final String frontendUrl;

    public static final String BOT_MARKER = "<!-- livingdocs-drift-alert -->";

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
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl,
            @Value("${github.oauth.frontend-url:${github.frontend-url:http://localhost:3000}}") String frontendUrl) {
        this.codeDiffAnalysisService = codeDiffAnalysisService;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.alertRepository = alertRepository;
        this.repositoryRepository = repositoryRepository;
        this.pullRequestRepository = pullRequestRepository;
        this.connectionRepository = connectionRepository;
        this.gitHubClient = gitHubClient;
        this.frontendUrl = StringUtils.hasText(frontendUrl) ? frontendUrl.trim() : "http://localhost:3000";
        if (StringUtils.hasText(aiEngineUrl)) {
            org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(2000);
            requestFactory.setReadTimeout(5000);
            this.restClient = RestClient.builder().requestFactory(requestFactory).baseUrl(aiEngineUrl).build();
        } else {
            this.restClient = null;
        }
    }

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
            RestClient restClient,
            String frontendUrl) {
        this.codeDiffAnalysisService = codeDiffAnalysisService;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.alertRepository = alertRepository;
        this.repositoryRepository = repositoryRepository;
        this.pullRequestRepository = pullRequestRepository;
        this.connectionRepository = connectionRepository;
        this.gitHubClient = gitHubClient;
        this.restClient = restClient;
        this.frontendUrl = StringUtils.hasText(frontendUrl) ? frontendUrl.trim() : "http://localhost:3000";
    }

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
            String aiEngineUrl) {
        this(codeDiffAnalysisService, docCodeLinkRepository, documentRepository, documentVersionRepository,
                alertRepository, repositoryRepository, pullRequestRepository, connectionRepository, gitHubClient,
                aiEngineUrl, "http://localhost:3000");
    }

    public DocDriftDetectionService(
            CodeDiffAnalysisServicePort codeDiffAnalysisService,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentChangeAlertRepository alertRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataPullRequestRepository pullRequestRepository,
            SpringDataGitHubConnectionRepository connectionRepository,
            GitHubClientPort gitHubClient) {
        this(codeDiffAnalysisService, docCodeLinkRepository, documentRepository, null,
                alertRepository, repositoryRepository, pullRequestRepository, connectionRepository, gitHubClient,
                (RestClient) null, "http://localhost:3000");
    }

    @Override
    public List<AffectedDocumentResultDto> findAffectedDocumentsForPullRequest(Long repositoryId, int prNumber) {
        log.info("[DocDrift] Bắt đầu quy trình tự động kéo Git Diff và tìm tài liệu ảnh hưởng cho PR #{} (repo={})",
                prNumber, repositoryId);
        AstDiffRequestDto diffRequest = codeDiffAnalysisService.fetchPullRequestDiff(repositoryId, prNumber);
        return findAffectedDocuments(repositoryId, diffRequest);
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
                String severity = resolveSeverity(entity.impact_level(), changeType);
                String details = entity.details();

                // 1. Tìm doc_code_links khớp chính xác file_path + methodName hoặc className
                List<DocCodeLinkEntity> matchedLinks = docCodeLinkRepository.findMatchingLinks(filePath, className,
                        methodName);

                // Nếu không có link khớp method, tìm link liên kết ở cấp độ file/class
                if (matchedLinks.isEmpty()) {
                    matchedLinks = docCodeLinkRepository.findMatchingLinks(filePath, className, null);
                }

                // Nếu vẫn chưa có trong doc_code_links, fallback tìm document theo target_path
                // hoặc title liên quan
                if (matchedLinks.isEmpty()) {
                    List<DocumentEntity> directDocs = documentRepository.findByRepoId(repositoryId);
                    boolean foundRelated = false;
                    for (DocumentEntity d : directDocs) {
                        if (isDocumentRelatedToPath(d, filePath, className)) {
                            foundRelated = true;
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
                    // Nếu chưa có tài liệu nào khớp chính xác tên file, gán vào tài liệu đầu tiên
                    // của repo để theo dõi
                    if (!foundRelated && !directDocs.isEmpty()) {
                        DocumentEntity fallbackDoc = directDocs.get(0);
                        String key = fallbackDoc.getDocId() + ":" + methodName;
                        if (seenDocEntityKeys.add(key)) {
                            affectedDocs.add(AffectedDocumentResultDto.builder()
                                    .documentId(fallbackDoc.getDocId())
                                    .documentTitle(fallbackDoc.getTitle())
                                    .documentPath(fallbackDoc.getTargetPath())
                                    .relatedFilePath(filePath)
                                    .className(className)
                                    .methodName(methodName)
                                    .changeType(changeType)
                                    .severity(severity)
                                    .details(details)
                                    .build());
                        }
                    }
                } else {
                    for (DocCodeLinkEntity link : matchedLinks) {
                        String key = link.getDocumentId() + ":" + methodName;
                        if (seenDocEntityKeys.add(key)) {
                            Optional<DocumentEntity> docOpt = documentRepository.findById(link.getDocumentId());
                            String title = docOpt.map(DocumentEntity::getTitle)
                                    .orElse("Tài liệu #" + link.getDocumentId());
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
    public PrDriftAnalysisResultDto detectDriftAndCommentOnPr(Long repositoryId, int prNumber) {
        AstDiffRequestDto diffRequest = codeDiffAnalysisService.fetchPullRequestDiff(repositoryId, prNumber);
        return detectDriftAndCommentOnPr(repositoryId, prNumber, diffRequest);
    }

    @Override
    @Transactional
    public PrDriftAnalysisResultDto detectDriftAndCommentOnPr(Long repositoryId, int prNumber,
            AstDiffRequestDto diffRequest) {
        log.info("[DocDrift] Khởi chạy quy trình phát hiện sai lệch và comment lên PR #{} (repo={})", prNumber,
                repositoryId);

        RepositoryEntity repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy repository ID: " + repositoryId));

        // 1. Tìm các tài liệu bị ảnh hưởng thông qua AST và doc_code_links
        List<AffectedDocumentResultDto> affectedDocs = findAffectedDocuments(repositoryId, diffRequest);

        // 2. Lấy thông tin PR Entity nếu có
        Optional<PullRequestEntity> prOpt = pullRequestRepository.findByRepositoryIdAndPrNumber(repositoryId, prNumber);
        Long prId = prOpt.map(PullRequestEntity::getPrId).orElse(null);

        // 3. Tạo bản ghi vào bảng document_change_alerts (drift_alerts) với phân tích
        // AI ngữ nghĩa nếu có
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

            // Gọi AI Semantic Drift (/v1/drift/analyze) để đánh giá ngữ nghĩa chuyên sâu
            // bằng Gemini
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

        // 4. Định dạng Markdown comment chi tiết và chuyên nghiệp kèm deep link tới trang cảnh báo
        String commentMarkdown = buildPrDriftCommentMarkdown(prNumber, affectedDocs, diffRequest, savedAlerts);

        // 5. Gọi GitHub REST API đăng mới hoặc cập nhật comment cũ trên PR
        Long commentId = null;
        String repoFullName = repo.getRepoFullName();
        String commentUrl = null;

        try {
            String token = resolveGitHubToken(repo);
            String[] parts = repoFullName.split("/");
            if (parts.length == 2 && token != null) {
                String owner = parts[0];
                String repoName = parts[1];

                // Tự động kiểm tra và cập nhật comment cũ nếu PR được push thêm commit mới
                // (synchronize)
                Long existingCommentId = gitHubClient.findExistingPullRequestComment(token, owner, repoName, prNumber,
                        BOT_MARKER);
                if (existingCommentId != null && existingCommentId > 0) {
                    log.info("[DocDrift] Tìm thấy comment cảnh báo cũ ID={} trên PR #{}. Đang cập nhật nội dung mới...",
                            existingCommentId, prNumber);
                    commentId = gitHubClient.updatePullRequestComment(token, owner, repoName, existingCommentId,
                            commentMarkdown);
                } else {
                    log.info("[DocDrift] Chưa có comment cũ trên PR #{}. Đăng comment cảnh báo mới...", prNumber);
                    commentId = gitHubClient.createPullRequestComment(token, owner, repoName, prNumber,
                            commentMarkdown);
                }

                commentUrl = String.format("https://github.com/%s/pull/%d#issuecomment-%s", repoFullName, prNumber,
                        commentId != null ? commentId : "latest");
                log.info("[DocDrift] Đã đăng/cập nhật comment cảnh báo lên PR #{} thành công! CommentId={}", prNumber,
                        commentId);
            } else {
                log.warn(
                        "[DocDrift] Không có GitHub Token hợp lệ hoặc tên repo sai ({}), bỏ qua gửi HTTP comment trực tiếp.",
                        repoFullName);
            }
        } catch (Exception ex) {
            log.error("[DocDrift] Không thể đăng hoặc cập nhật comment lên GitHub PR #{}: {}", prNumber,
                    ex.getMessage(), ex);
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
                .message("Phát hiện " + affectedDocs.size()
                        + " tài liệu bị ảnh hưởng. Đã đăng/cập nhật cảnh báo lên PR #"
                        + prNumber)
                .build();
    }

    @Override
    public String generateDriftCommentMarkdown(int prNumber, List<AffectedDocumentResultDto> affectedDocs,
            AstDiffRequestDto diffRequest) {
        return buildPrDriftCommentMarkdown(prNumber, affectedDocs, diffRequest, null);
    }

    private String resolveSeverity(String impactLevel, String changeType) {
        if (StringUtils.hasText(impactLevel) && !impactLevel.equalsIgnoreCase("UNKNOWN")) {
            return impactLevel.toUpperCase();
        }
        if (changeType == null)
            return "MEDIUM";
        return switch (changeType.toUpperCase()) {
            case "DELETED" -> "CRITICAL";
            case "RENAMED", "PARAM_CHANGED", "SIGNATURE_CHANGED" -> "HIGH";
            case "RETURN_TYPE_CHANGED" -> "MEDIUM";
            case "ADDED" -> "LOW";
            default -> "MEDIUM";
        };
    }

    /**
     * Gọi AI Engine (/v1/drift/analyze) để phân tích sai lệch ngữ nghĩa qua Gemini.
     */
    private AiDriftAnalyzeResponseDto analyzeDriftWithAi(AffectedDocumentResultDto item, AstDiffRequestDto diffRequest,
            int prNumber, Long repositoryId) {
        if (restClient == null) {
            return null;
        }
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

    private String buildPrDriftCommentMarkdown(int prNumber, List<AffectedDocumentResultDto> affectedDocs,
            AstDiffRequestDto diffRequest, List<DocumentChangeAlertEntity> savedAlerts) {
        StringBuilder sb = new StringBuilder();
        sb.append(BOT_MARKER).append("\n");
        sb.append("## 🚨 LivingDocs — Cảnh Báo Trôi Dạt Tài Liệu (Documentation Drift Alert)\n\n");
        sb.append(String.format("Phân tích AST tự động cho **Pull Request #%d** (Commit: `%s`):\n\n",
                prNumber, diffRequest != null && diffRequest.head_commit_hash() != null ? diffRequest.head_commit_hash()
                        : "HEAD"));

        Long firstAlertId = (savedAlerts != null && !savedAlerts.isEmpty())
                ? savedAlerts.get(0).getAlertId()
                : null;
        String defaultAlertUrl = firstAlertId != null
                ? String.format("%s/canh-bao-sai-lech?alertId=%d", frontendUrl, firstAlertId)
                : String.format("%s/canh-bao-sai-lech", frontendUrl);

        if (affectedDocs == null || affectedDocs.isEmpty()) {
            sb.append(
                    "> ✨ **Không phát hiện sự sai lệch tài liệu nào!** Các hàm được thêm mới hoặc giữ nguyên chữ ký tương thích với tài liệu hiện tại.\n\n");
            sb.append(String.format(
                    "[![LivingDocs Web App](https://img.shields.io/badge/LivingDocs-Mở_Giao_Diện_Web-10b981?style=for-the-badge&logo=googledocs&logoColor=white)](%s/canh-bao-sai-lech)\n\n",
                    frontendUrl));
            sb.append("---\n*🤖 Báo cáo được tự động cập nhật bởi **LivingDocs CI/CD Bot**.*");
            return sb.toString();
        }

        // 1. Bảng tổng hợp mức độ sai lệch
        long criticalCount = affectedDocs.stream().filter(d -> "CRITICAL".equalsIgnoreCase(d.severity())).count();
        long highCount = affectedDocs.stream().filter(d -> "HIGH".equalsIgnoreCase(d.severity())).count();
        long mediumCount = affectedDocs.stream().filter(d -> "MEDIUM".equalsIgnoreCase(d.severity())).count();
        long lowCount = affectedDocs.stream().filter(d -> "LOW".equalsIgnoreCase(d.severity())).count();

        sb.append("### 📊 Bảng tổng hợp mức độ sai lệch\n\n");
        sb.append("| Mức độ nghiêm trọng | Số lượng | Hành động bắt buộc |\n");
        sb.append("| :--- | :---: | :--- |\n");
        sb.append(String.format(
                "| 🔴 **CRITICAL** | `%d` | Hàm bị xóa hoặc đổi tên làm gãy tài liệu, cần cập nhật ngay |\n",
                criticalCount));
        sb.append(String.format("| 🟠 **HIGH** | `%d` | Chữ ký tham số hoặc kiểu trả về thay đổi |\n", highCount));
        sb.append(
                String.format("| 🟡 **MEDIUM** | `%d` | Logic nội bộ hoặc cấu trúc thay đổi đáng kể |\n", mediumCount));
        sb.append(String.format("| 🔵 **LOW** | `%d` | Hàm mới được thêm vào, bổ sung tài liệu nếu cần |\n", lowCount));
        sb.append(String.format("| 📌 **Tổng cộng** | **`%d`** | **Cần xem xét trước khi Merge PR** |\n\n",
                affectedDocs.size()));

        // 2. Danh sách tài liệu bị ảnh hưởng, tên hàm thay đổi và nút dẫn link tới
        // trang web LivingDocs
        sb.append("### 📑 Danh sách tài liệu và hàm bị ảnh hưởng\n\n");
        sb.append("| Mức độ | Tài liệu liên kết | Hàm thay đổi | Loại thay đổi | Chi tiết thay đổi | Thao tác |\n");
        sb.append("| :---: | :--- | :--- | :---: | :--- | :---: |\n");

        Map<Long, Long> docIdToAlertId = new HashMap<>();
        if (savedAlerts != null) {
            for (DocumentChangeAlertEntity alert : savedAlerts) {
                if (alert.getDocumentId() != null && alert.getAlertId() != null) {
                    docIdToAlertId.putIfAbsent(alert.getDocumentId(), alert.getAlertId());
                }
            }
        }

        for (AffectedDocumentResultDto item : affectedDocs) {
            String badge = switch (item.severity() != null ? item.severity().toUpperCase() : "MEDIUM") {
                case "CRITICAL" -> "🔴 **CRITICAL**";
                case "HIGH" -> "🟠 **HIGH**";
                case "MEDIUM" -> "🟡 **MEDIUM**";
                default -> "🔵 **LOW**";
            };

            Long matchedAlertId = item.documentId() != null ? docIdToAlertId.get(item.documentId()) : null;
            String deepLinkUrl = matchedAlertId != null
                    ? String.format("%s/canh-bao-sai-lech?alertId=%d", frontendUrl, matchedAlertId)
                    : defaultAlertUrl;

            String docTitle = item.documentTitle() != null ? item.documentTitle() : "Tài liệu liên kết";
            String docPath = item.documentPath() != null ? item.documentPath() : item.relatedFilePath();
            String docLink = String.format("[%s](%s)<br>`%s`", docTitle, deepLinkUrl, docPath);

            String actionBtn = String.format("[🔍 Xử lý sai lệch](%s)", deepLinkUrl);

            String detailsClean = item.details() != null ? item.details().replace("\n", " ") : "-";

            sb.append(String.format("| %s | %s | `%s` | `%s` | %s | %s |\n",
                    badge,
                    docLink,
                    item.methodName() != null ? item.methodName() : "-",
                    item.changeType() != null ? item.changeType() : "-",
                    detailsClean,
                    actionBtn));
        }

        // 3. Khối hướng dẫn hành động & Nút dẫn link tới LivingDocs Web
        sb.append("\n### 🛠️ Hành động đề xuất cho Developer & Reviewer:\n");
        sb.append(
                "1. ⚠️ **Reviewer:** Yêu cầu cập nhật tài liệu kỹ thuật trước khi chấp thuận **Merge** Pull Request này.\n");
        sb.append(
                "2. 🤖 **Developer:** Mở ứng dụng LivingDocs để xem đề xuất cập nhật tự động bằng AI (Auto-Update Document):\n\n");
        sb.append(String.format(
                "[![LivingDocs Web App](https://img.shields.io/badge/LivingDocs-Xử_Lý_Sai_Lệch_Ngay-2563eb?style=for-the-badge&logo=googledocs&logoColor=white)](%s)\n\n",
                defaultAlertUrl));
        sb.append(
                "---\n*🤖 Báo cáo được tự động đăng và cập nhật bởi **LivingDocs CI/CD Bot** mỗi khi PR nhận commit mới (synchronize).*");

        return sb.toString();
    }

    private boolean isDocumentRelatedToPath(DocumentEntity doc, String filePath, String className) {
        if (doc.getTargetPath() != null && doc.getTargetPath().contains(filePath)) {
            return true;
        }
        if (className != null && doc.getTitle() != null
                && doc.getTitle().toLowerCase().contains(className.toLowerCase())) {
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
