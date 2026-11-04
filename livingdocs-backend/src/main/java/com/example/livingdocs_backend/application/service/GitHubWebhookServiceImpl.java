package com.example.livingdocs_backend.application.service;

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
    private final ObjectMapper objectMapper;
    private final JobQueue jobQueue;

    public static final String JOB_TYPE_PR_DRIFT_SCAN = "PR_DRIFT_SCAN";
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

        if (commitsNode != null && commitsNode.isArray()) {
            for (JsonNode cNode : commitsNode) {
                String sha = cNode.path("id").asText();
                if (!StringUtils.hasText(sha))
                    continue;

                String message = cNode.path("message").asText();
                String authorName = cNode.path("author").path("name").asText("Unknown");
                String authorEmail = cNode.path("author").path("email").asText();
                String timestampStr = cNode.path("timestamp").asText();

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

        // Cập nhật last_synced_at cho repository
        repo.setLastSyncedAt(Instant.now());
        repo.setUpdatedAt(Instant.now());
        repositoryRepository.save(repo);

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
                .message("Đã lưu thành công " + savedCommits + " commits")
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
            } catch (Exception e) {
                log.error("[Webhook - PR] Lỗi khi tạo Job quét Drift cho PR #{}: {}", prNumber, e.getMessage(), e);
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
        if (githubRepoId != null && githubRepoId > 0) {
            Optional<RepositoryEntity> byId = repositoryRepository.findAll().stream()
                    .filter(r -> githubRepoId.equals(r.getGithubRepoId()) || githubRepoId.equals(r.getRepositoryId()))
                    .findFirst();
            if (byId.isPresent())
                return byId.get();
        }

        if (StringUtils.hasText(repoFullName)) {
            return repositoryRepository.findAll().stream()
                    .filter(r -> repoFullName.equalsIgnoreCase(r.getRepoFullName()))
                    .findFirst()
                    .orElse(null);
        }

        return null;
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
