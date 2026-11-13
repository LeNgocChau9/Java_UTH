package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.drift.AutoDocUpdateJobPayload;
import com.example.livingdocs_backend.application.dto.drift.PrDriftScanJobPayload;
import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.GitHubWebhookServicePort;
import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCommitRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Service xử lý chữ ký bảo mật HMAC-SHA256 (X-Hub-Signature-256) và bóc tách dữ
 * liệu sự kiện push / pull_request từ GitHub.
 * Trích xuất: repository full name, PR number, base commit SHA, head commit
 * SHA, tác giả commit.
 * Tự động đẩy Job ngầm quét Drift vào luồng phân tích khi phát hiện Pull
 * Request hoặc thay đổi mã nguồn.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubWebhookServiceImpl implements GitHubWebhookServicePort {

    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataPullRequestRepository pullRequestRepository;
    private final SpringDataCommitRepository commitRepository;
    private final com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository alertRepository;
    private final com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository documentRepository;
    private final ObjectMapper objectMapper;
    private final JobQueue jobQueue;

    public static final String JOB_TYPE_PR_DRIFT_SCAN = "PR_DRIFT_SCAN";
    public static final String JOB_TYPE_AUTO_DOC_UPDATE = "AUTO_DOC_UPDATE";
    private static final Set<String> DRIFT_TRIGGER_ACTIONS = Set.of("opened", "synchronize", "reopened");

    @Value("${github.webhook.secret:}")
    private String webhookSecret;

    @Override
    public boolean verifySignature(String payloadRaw, String signatureHeader) {
        if (!StringUtils.hasText(webhookSecret)) {
            log.warn("[Webhook] github.webhook.secret chưa được cấu hình. Bỏ qua xác thực chữ ký (Development mode).");
            return true;
        }

        if (!StringUtils.hasText(signatureHeader) || !signatureHeader.toLowerCase().startsWith("sha256=")) {
            log.error("[Webhook] Thiếu hoặc sai định dạng header X-Hub-Signature-256: {}", signatureHeader);
            return false;
        }

        String expectedHash = signatureHeader.substring(7).trim();

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(payloadRaw.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hmacBytes) {
                hex.append(String.format("%02x", b));
            }
            String actualHash = hex.toString();

            // So sánh an toàn chống tấn công timing attack
            boolean match = MessageDigest.isEqual(
                    actualHash.toLowerCase().getBytes(StandardCharsets.UTF_8),
                    expectedHash.toLowerCase().getBytes(StandardCharsets.UTF_8));
            if (!match) {
                log.error("[Webhook] Chữ ký HMAC-SHA256 không khớp! Nhận: {}, Tính toán: {}", expectedHash, actualHash);
            }
            return match;
        } catch (Exception ex) {
            log.error("[Webhook] Lỗi khi tính toán HMAC-SHA256: {}", ex.getMessage(), ex);
            return false;
        }
    }

    @Override
    @Transactional
    public WebhookProcessingResult processWebhook(String eventType, String payloadJson) {
        if ("ping".equalsIgnoreCase(eventType)) {
            log.info("[Webhook] Nhận sự kiện ping từ GitHub. Webhook hoạt động bình thường.");
            return WebhookProcessingResult.builder()
                    .success(true)
                    .eventType("ping")
                    .message("Ping event received successfully")
                    .build();
        }

        try {
            JsonNode root = objectMapper.readTree(payloadJson);
            JsonNode repoNode = root.get("repository");
            if (repoNode == null) {
                log.warn("[Webhook] Không tìm thấy thông tin repository trong payload.");
                return WebhookProcessingResult.builder()
                        .success(false)
                        .eventType(eventType)
                        .message("Thiếu thông tin repository trong payload")
                        .build();
            }

            String repoFullName = repoNode.path("full_name").asText();
            Long githubRepoId = repoNode.path("id").asLong();

            // Tìm RepositoryEntity trong database theo githubRepoId hoặc fullName
            RepositoryEntity repo = findRepository(githubRepoId, repoFullName);
            if (repo == null) {
                log.warn("[Webhook] Repository [{}] (ID: {}) chưa được thêm vào bất kỳ Workspace nào trong hệ thống.",
                        repoFullName, githubRepoId);
                return WebhookProcessingResult.builder()
                        .success(true)
                        .eventType(eventType)
                        .repoFullName(repoFullName)
                        .affectedCount(0)
                        .message("Repository chưa được kết nối vào hệ thống")
                        .build();
            }

            if ("push".equalsIgnoreCase(eventType)) {
                return handlePushEvent(repo, root);
            } else if ("pull_request".equalsIgnoreCase(eventType)) {
                return handlePullRequestEvent(repo, root);
            } else {
                log.info("[Webhook] Bỏ qua sự kiện không xử lý: {}", eventType);
                return WebhookProcessingResult.builder()
                        .success(true)
                        .eventType(eventType)
                        .repoFullName(repoFullName)
                        .message("Bỏ qua sự kiện chưa hỗ trợ: " + eventType)
                        .build();
            }
        } catch (Exception ex) {
            log.error("[Webhook] Lỗi phân tích payload JSON: {}", ex.getMessage(), ex);
            return WebhookProcessingResult.builder()
                    .success(false)
                    .eventType(eventType)
                    .message("Lỗi phân tích payload: " + ex.getMessage())
                    .build();
        }
    }

    private WebhookProcessingResult handlePushEvent(RepositoryEntity repo, JsonNode root) {
        String baseCommitSha = root.path("before").asText(null);
        String headCommitSha = root.path("after").asText(null);

        // Xác định headCommitSha dự phòng từ head_commit.id
        if (!StringUtils.hasText(headCommitSha) || "0000000000000000000000000000000000000000".equals(headCommitSha)) {
            if (root.hasNonNull("head_commit") && root.path("head_commit").hasNonNull("id")) {
                headCommitSha = root.path("head_commit").path("id").asText();
            }
        }

        // Xác định tác giả commit: ưu tiên head_commit.author -> pusher.name ->
        // commits[0].author
        String commitAuthor = "Unknown";
        if (root.hasNonNull("head_commit") && root.path("head_commit").hasNonNull("author")) {
            commitAuthor = root.path("head_commit").path("author").path("name").asText("Unknown");
        } else if (root.hasNonNull("pusher") && root.path("pusher").hasNonNull("name")) {
            commitAuthor = root.path("pusher").path("name").asText("Unknown");
        }

        JsonNode commitsNode = root.get("commits");
        int savedCommits = 0;
        List<String> changedFiles = new ArrayList<>();
        String latestCommitMessage = "";

        if (commitsNode != null && commitsNode.isArray()) {
            for (JsonNode cNode : commitsNode) {
                String sha = cNode.path("id").asText();
                if (!StringUtils.hasText(sha))
                    continue;

                String message = cNode.path("message").asText();
                if (StringUtils.hasText(message)) {
                    latestCommitMessage = message;
                }
                String authorName = cNode.path("author").path("name").asText("Unknown");
                String authorEmail = cNode.path("author").path("email").asText();
                String timestampStr = cNode.path("timestamp").asText();

                collectFiles(cNode.get("added"), changedFiles);
                collectFiles(cNode.get("modified"), changedFiles);

                if ("Unknown".equals(commitAuthor) && !"Unknown".equals(authorName)) {
                    commitAuthor = authorName;
                }

                Instant committedAt;
                try {
                    committedAt = StringUtils.hasText(timestampStr) ? Instant.parse(timestampStr) : Instant.now();
                } catch (Exception e) {
                    committedAt = Instant.now();
                }

                CommitEntity commit = commitRepository
                        .findByRepositoryIdAndCommitHash(repo.getRepositoryId(), sha)
                        .orElseGet(() -> CommitEntity.builder()
                                .repositoryId(repo.getRepositoryId())
                                .commitHash(sha)
                                .createdAt(Instant.now())
                                .build());

                commit.setAuthorName(authorName);
                commit.setAuthorEmail(authorEmail);
                commit.setCommitMessage(message);
                commit.setCommittedAt(committedAt);

                commitRepository.save(commit);
                savedCommits++;
            }
        }

        // Thu thập thêm file thay đổi từ head_commit nếu có
        if (root.hasNonNull("head_commit")) {
            JsonNode hc = root.get("head_commit");
            collectFiles(hc.get("added"), changedFiles);
            collectFiles(hc.get("modified"), changedFiles);
            if (StringUtils.hasText(hc.path("message").asText())) {
                latestCommitMessage = hc.path("message").asText();
            }
        }

        String diffContent = root.path("diff_content").asText(null);
        if (!StringUtils.hasText(diffContent) && root.hasNonNull("diff")) {
            diffContent = root.path("diff").asText(null);
        }

        // Cập nhật last_synced_at cho repository
        repo.setLastSyncedAt(Instant.now());
        repo.setUpdatedAt(Instant.now());
        repositoryRepository.save(repo);

        // Kích hoạt pipeline tự động cập nhật tài liệu khi mã nguồn có commit mới (hỗ trợ tổng quát mọi định dạng code)
        String autoUpdateMsg = "";
        try {
            List<String> targetFiles = new ArrayList<>();
            for (String f : changedFiles) {
                if (f != null && isTextOrSourceFile(f)) {
                    targetFiles.add(f);
                }
            }
            if (targetFiles.isEmpty() && !changedFiles.isEmpty()) {
                targetFiles.addAll(changedFiles);
            }

            AutoDocUpdateJobPayload autoDocPayload = AutoDocUpdateJobPayload.builder()
                    .repositoryId(repo.getRepositoryId())
                    .repoFullName(repo.getRepoFullName())
                    .eventType("push")
                    .headCommitSha(headCommitSha)
                    .baseCommitSha(baseCommitSha)
                    .commitAuthor(commitAuthor)
                    .commitMessage(latestCommitMessage)
                    .changedFiles(targetFiles)
                    .diffContent(diffContent)
                    .build();

            String payloadJson = objectMapper.writeValueAsString(autoDocPayload);
            jobQueue.enqueue(JOB_TYPE_AUTO_DOC_UPDATE, payloadJson);
            autoUpdateMsg = " | Đã kích hoạt Auto-Update Pipeline cho tài liệu";
            log.info("[Webhook - Push] Đã kích hoạt Job [{}] cho commit {} (repo: {})",
                    JOB_TYPE_AUTO_DOC_UPDATE, headCommitSha, repo.getRepoFullName());

            // Ghi nhận cảnh báo sai lệch (Drift Alert PENDING) cho commit mới để thông báo trên chuông
            if (alertRepository != null) {
                final String finalHeadSha = headCommitSha;
                boolean duplicate = alertRepository.findByRepositoryId(repo.getRepositoryId()).stream()
                        .anyMatch(a -> finalHeadSha != null && finalHeadSha.equals(a.getSourceCommit())
                                && "PENDING".equalsIgnoreCase(a.getStatus()));
                if (!duplicate) {
                    Long linkedDocId = null;
                    if (documentRepository != null) {
                        var docs = documentRepository.findByRepoIdOrderByUpdatedAtDesc(repo.getRepositoryId());
                        if (docs != null && !docs.isEmpty()) {
                            linkedDocId = docs.get(0).getDocId();
                        }
                    }
                    com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity driftAlert =
                            com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity.builder()
                                    .repositoryId(repo.getRepositoryId())
                                    .documentId(linkedDocId)
                                    .sourceCommit(finalHeadSha)
                                    .classification("SEMANTIC")
                                    .severity("MEDIUM")
                                    .status("PENDING")
                                    .details(String.format("Commit mới %s từ %s: %s",
                                            (finalHeadSha != null && finalHeadSha.length() > 7 ? finalHeadSha.substring(0, 7) : finalHeadSha),
                                            commitAuthor != null ? commitAuthor : "Developer",
                                            latestCommitMessage != null && !latestCommitMessage.isBlank() ? latestCommitMessage : "Cập nhật mã nguồn"))
                                    .createdAt(Instant.now())
                                    .build();
                    alertRepository.save(driftAlert);
                    log.info("[Webhook - Push] Đã ghi nhận cảnh báo sai lệch (Drift Alert PENDING) cho commit {}", finalHeadSha);
                }
            }
        } catch (Exception e) {
            log.error("[Webhook - Push] Lỗi khi tạo Job Auto-Update: {}", e.getMessage(), e);
        }

        log.info("[Webhook - Push] Đã lưu {} commits vào repo [{}] (Base: {}, Head: {}, Tác giả: {})",
                savedCommits, repo.getRepoFullName(), baseCommitSha, headCommitSha, commitAuthor);

        return WebhookProcessingResult.builder()
                .success(true)
                .eventType("push")
                .repoFullName(repo.getRepoFullName())
                .baseCommitSha(baseCommitSha)
                .headCommitSha(headCommitSha)
                .commitAuthor(commitAuthor)
                .affectedCount(savedCommits)
                .message("Đã lưu thành công " + savedCommits + " commits" + autoUpdateMsg)
                .build();
    }

    private WebhookProcessingResult handlePullRequestEvent(RepositoryEntity repo, JsonNode root) {
        String action = root.path("action").asText();
        JsonNode prNode = root.get("pull_request");

        if (prNode == null) {
            return WebhookProcessingResult.builder()
                    .success(false)
                    .eventType("pull_request")
                    .action(action)
                    .repoFullName(repo.getRepoFullName())
                    .message("Thiếu khối pull_request trong payload")
                    .build();
        }

        int prNumber = prNode.path("number").asInt();
        long githubPrId = prNode.path("id").asLong();
        String title = prNode.path("title").asText("No title");
        String state = prNode.path("state").asText("open").toUpperCase();
        boolean merged = prNode.path("merged").asBoolean(false);
        if (merged) {
            state = "MERGED";
        } else if ("closed".equalsIgnoreCase(action)) {
            state = "CLOSED";
        }

        String headBranch = prNode.path("head").path("ref").asText();
        String headCommitHash = prNode.path("head").path("sha").asText();
        String baseBranch = prNode.path("base").path("ref").asText();
        String baseCommitHash = prNode.path("base").path("sha").asText();
        String authorUsername = prNode.path("user").path("login").asText();

        // Tác giả commit: ưu tiên head user login hoặc author của PR
        String commitAuthor = authorUsername;
        if (prNode.hasNonNull("head") && prNode.path("head").hasNonNull("user")) {
            String headUser = prNode.path("head").path("user").path("login").asText();
            if (StringUtils.hasText(headUser)) {
                commitAuthor = headUser;
            }
        }

        Instant createdAt = parseInstant(prNode.path("created_at").asText());
        Instant updatedAt = parseInstant(prNode.path("updated_at").asText());
        Instant closedAt = parseInstant(prNode.path("closed_at").asText());

        PullRequestEntity prEntity = pullRequestRepository
                .findByRepositoryIdAndPrNumber(repo.getRepositoryId(), prNumber)
                .orElseGet(() -> PullRequestEntity.builder()
                        .repositoryId(repo.getRepositoryId())
                        .prNumber(prNumber)
                        .createdAt(Instant.now())
                        .build());

        prEntity.setGithubPrId(githubPrId);
        prEntity.setTitle(title);
        prEntity.setHeadBranch(headBranch);
        prEntity.setHeadCommitHash(headCommitHash);
        prEntity.setBaseBranch(baseBranch);
        prEntity.setBaseCommitHash(baseCommitHash);
        prEntity.setState(state);
        prEntity.setAuthorUsername(authorUsername);
        prEntity.setGithubCreatedAt(createdAt);
        prEntity.setGithubUpdatedAt(updatedAt);
        prEntity.setGithubClosedAt(closedAt);
        prEntity.setUpdatedAt(Instant.now());

        pullRequestRepository.save(prEntity);

        // Cập nhật last_synced_at cho repository
        repo.setLastSyncedAt(Instant.now());
        repo.setUpdatedAt(Instant.now());
        repositoryRepository.save(repo);

        log.info("[Webhook - PR] Đã lưu/cập nhật PR #{}: [{}] trạng thái [{}] cho repo [{}] (action: {}, author: {})",
                prNumber, title, state, repo.getRepoFullName(), action, commitAuthor);

        // Kích hoạt quét sai lệch tài liệu (Drift Scan) qua bảng jobs nếu action là
        // opened, synchronize, hoặc reopened
        String jobStatusMsg = "";
        if (DRIFT_TRIGGER_ACTIONS.contains(action.toLowerCase())) {
            try {
                PrDriftScanJobPayload jobPayload = PrDriftScanJobPayload.builder()
                        .repositoryId(repo.getRepositoryId())
                        .repoFullName(repo.getRepoFullName())
                        .prNumber(prNumber)
                        .prTitle(title)
                        .authorUsername(commitAuthor)
                        .headCommitHash(headCommitHash)
                        .baseCommitHash(baseCommitHash)
                        .action(action)
                        .build();

                String payloadJson = objectMapper.writeValueAsString(jobPayload);
                jobQueue.enqueue(JOB_TYPE_PR_DRIFT_SCAN, payloadJson);
                jobStatusMsg = " | Đã lên lịch quét sai lệch (Drift Scan Job)";
                log.info("[Webhook - PR] Đã đẩy Job [{}] cho PR #{} (repo: {}) vào hàng đợi ngầm",
                        JOB_TYPE_PR_DRIFT_SCAN, prNumber, repo.getRepoFullName());

                // Ghi nhận cảnh báo sai lệch (Drift Alert PENDING) cho Pull Request
                if (alertRepository != null) {
                    boolean duplicate = alertRepository.findByRepositoryId(repo.getRepositoryId()).stream()
                            .anyMatch(a -> Long.valueOf(prNumber).equals(a.getSourcePrId())
                                    && "PENDING".equalsIgnoreCase(a.getStatus()));
                    if (!duplicate) {
                        Long linkedDocId = null;
                        if (documentRepository != null) {
                            var docs = documentRepository.findByRepoIdOrderByUpdatedAtDesc(repo.getRepositoryId());
                            if (docs != null && !docs.isEmpty()) {
                                linkedDocId = docs.get(0).getDocId();
                            }
                        }
                        com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity prAlert =
                                com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity.builder()
                                        .repositoryId(repo.getRepositoryId())
                                        .documentId(linkedDocId)
                                        .sourcePrId((long) prNumber)
                                        .sourceCommit(headCommitHash)
                                        .classification("SEMANTIC")
                                        .severity("HIGH")
                                        .status("PENDING")
                                        .details(String.format("Pull Request #%d (%s) từ %s: %s",
                                                prNumber, action, commitAuthor != null ? commitAuthor : "Developer", title))
                                        .createdAt(Instant.now())
                                        .build();
                        alertRepository.save(prAlert);
                        log.info("[Webhook - PR] Đã ghi nhận cảnh báo sai lệch (Drift Alert PENDING) cho PR #{}", prNumber);
                    }
                }
            } catch (Exception e) {
                log.error("[Webhook - PR] Lỗi khi tạo Job quét Drift cho PR #{}: {}", prNumber, e.getMessage(), e);
            }
        }

        // Kích hoạt pipeline tự động cập nhật tài liệu khi PR được Merge vào nhánh chính
        if (merged) {
            try {
                List<String> prFiles = new ArrayList<>();
                if (prNode.hasNonNull("changed_files_list")) {
                    collectFiles(prNode.get("changed_files_list"), prFiles);
                }
                AutoDocUpdateJobPayload autoDocPayload = AutoDocUpdateJobPayload.builder()
                        .repositoryId(repo.getRepositoryId())
                        .repoFullName(repo.getRepoFullName())
                        .eventType("pull_request_merged")
                        .headCommitSha(headCommitHash)
                        .baseCommitSha(baseCommitHash)
                        .commitAuthor(commitAuthor)
                        .commitMessage("Merge PR #" + prNumber + ": " + title)
                        .changedFiles(prFiles)
                        .build();

                String payloadJson = objectMapper.writeValueAsString(autoDocPayload);
                jobQueue.enqueue(JOB_TYPE_AUTO_DOC_UPDATE, payloadJson);
                jobStatusMsg += " | Đã kích hoạt Auto-Update Pipeline cho PR merged";
                log.info("[Webhook - PR] Đã đẩy Job [{}] khi PR #{} được merge vào repo [{}]",
                        JOB_TYPE_AUTO_DOC_UPDATE, prNumber, repo.getRepoFullName());
            } catch (Exception e) {
                log.error("[Webhook - PR] Lỗi khi tạo Job Auto-Update cho PR #{}: {}", prNumber, e.getMessage(), e);
            }
        }

        return WebhookProcessingResult.builder()
                .success(true)
                .eventType("pull_request")
                .action(action)
                .repoFullName(repo.getRepoFullName())
                .prNumber(prNumber)
                .baseCommitSha(baseCommitHash)
                .headCommitSha(headCommitHash)
                .commitAuthor(commitAuthor)
                .affectedCount(1)
                .message("Đã cập nhật PR #" + prNumber + " (" + action + " -> " + state + ")" + jobStatusMsg)
                .build();
    }

    private RepositoryEntity findRepository(Long githubRepoId, String repoFullName) {
        List<RepositoryEntity> allRepos = repositoryRepository.findAll();
        if (allRepos.isEmpty()) {
            return null;
        }

        if (githubRepoId != null && githubRepoId > 0) {
            Optional<RepositoryEntity> byId = allRepos.stream()
                    .filter(r -> githubRepoId.equals(r.getGithubRepoId()) || githubRepoId.equals(r.getRepositoryId()))
                    .findFirst();
            if (byId.isPresent()) {
                return byId.get();
            }
        }

        if (StringUtils.hasText(repoFullName)) {
            Optional<RepositoryEntity> byName = allRepos.stream()
                    .filter(r -> repoFullName.equalsIgnoreCase(r.getRepoFullName())
                            || (r.getRepoName() != null
                                    && repoFullName.toLowerCase().endsWith("/" + r.getRepoName().toLowerCase()))
                            || (r.getRepoFullName() != null
                                    && r.getRepoFullName().toLowerCase().endsWith("/" + repoFullName.toLowerCase())))
                    .findFirst();
            if (byName.isPresent()) {
                return byName.get();
            }
        }

        // Dự phòng cho môi trường dev/local test khi trong DB chỉ có duy nhất 1
        // repository
        if (allRepos.size() == 1) {
            log.info("[Webhook] Sử dụng repository duy nhất [{}] làm fallback cho testing",
                    allRepos.get(0).getRepoFullName());
            return allRepos.get(0);
        }

        return null;
    }

    private void collectFiles(JsonNode node, List<String> list) {
        if (node != null && node.isArray()) {
            for (JsonNode f : node) {
                String path = f.asText();
                if (StringUtils.hasText(path) && !list.contains(path)) {
                    list.add(path);
                }
            }
        }
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

    private Instant parseInstant(String text) {
        if (!StringUtils.hasText(text))
            return null;
        try {
            return Instant.parse(text);
        } catch (Exception e) {
            return null;
        }
    }
}
