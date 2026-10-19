package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.GitHubWebhookServicePort;
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

/**
 * Service xử lý chữ ký bảo mật HMAC-SHA256 và bóc tách dữ liệu sự kiện push / pull_request từ GitHub.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubWebhookServiceImpl implements GitHubWebhookServicePort {

    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataPullRequestRepository pullRequestRepository;
    private final SpringDataCommitRepository commitRepository;
    private final ObjectMapper objectMapper;

    @Value("${github.webhook.secret:}")
    private String webhookSecret;

    @Override
    public boolean verifySignature(String payloadRaw, String signatureHeader) {
        if (!StringUtils.hasText(webhookSecret)) {
            log.warn("[Webhook] github.webhook.secret chưa được cấu hình. Bỏ qua xác thực chữ ký (Development mode).");
            return true;
        }

        if (!StringUtils.hasText(signatureHeader) || !signatureHeader.startsWith("sha256=")) {
            log.error("[Webhook] Thiếu hoặc sai định dạng header X-Hub-Signature-256: {}", signatureHeader);
            return false;
        }

        String expectedHash = signatureHeader.substring(7).trim();

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(payloadRaw.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hmacBytes) {
                hex.append(String.format("%02x", b));
            }
            String actualHash = hex.toString();

            // So sánh an toàn chống tấn công timing attack
            boolean match = MessageDigest.isEqual(actualHash.getBytes(StandardCharsets.UTF_8), expectedHash.getBytes(StandardCharsets.UTF_8));
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
        JsonNode commitsNode = root.get("commits");
        int savedCommits = 0;

        if (commitsNode != null && commitsNode.isArray()) {
            for (JsonNode cNode : commitsNode) {
                String sha = cNode.path("id").asText();
                if (!StringUtils.hasText(sha)) continue;

                String message = cNode.path("message").asText();
                String authorName = cNode.path("author").path("name").asText("Unknown");
                String authorEmail = cNode.path("author").path("email").asText();
                String timestampStr = cNode.path("timestamp").asText();

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

        log.info("[Webhook - Push] Đã lưu {} commits vào repo [{}]", savedCommits, repo.getRepoFullName());

        return WebhookProcessingResult.builder()
                .success(true)
                .eventType("push")
                .repoFullName(repo.getRepoFullName())
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
        }

        String headBranch = prNode.path("head").path("ref").asText();
        String headCommitHash = prNode.path("head").path("sha").asText();
        String baseBranch = prNode.path("base").path("ref").asText();
        String baseCommitHash = prNode.path("base").path("sha").asText();
        String authorUsername = prNode.path("user").path("login").asText();

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

        log.info("[Webhook - PR] Đã lưu/cập nhật PR #{}: [{}] trạng thái [{}] cho repo [{}] (action: {})",
                prNumber, title, state, repo.getRepoFullName(), action);

        return WebhookProcessingResult.builder()
                .success(true)
                .eventType("pull_request")
                .repoFullName(repo.getRepoFullName())
                .affectedCount(1)
                .message("Đã cập nhật PR #" + prNumber + " (" + state + ") thành công")
                .build();
    }

    private RepositoryEntity findRepository(Long githubRepoId, String repoFullName) {
        if (githubRepoId != null && githubRepoId > 0) {
            Optional<RepositoryEntity> byId = repositoryRepository.findAll().stream()
                    .filter(r -> githubRepoId.equals(r.getGithubRepoId()))
                    .findFirst();
            if (byId.isPresent()) return byId.get();
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
        if (!StringUtils.hasText(text)) return null;
        try {
            return Instant.parse(text);
        } catch (Exception e) {
            return null;
        }
    }
}
