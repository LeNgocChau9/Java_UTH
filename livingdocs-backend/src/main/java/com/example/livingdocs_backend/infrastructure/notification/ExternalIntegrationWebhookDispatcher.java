package com.example.livingdocs_backend.infrastructure.notification;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ExternalIntegrationEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataExternalIntegrationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Dispatcher gửi thông báo tự động qua Webhook (Slack Incoming Webhook, Discord Webhook, Custom Webhook)
 * cho 3 sự kiện chính:
 * 1. Cảnh báo sai lệch mã nguồn mức HIGH / CRITICAL (DRIFT_HIGH_CRITICAL)
 * 2. Developer gửi tài liệu cho Staff duyệt (REVIEW_SUBMITTED)
 * 3. Manager phê duyệt xuất bản tài liệu (DOCUMENT_PUBLISHED)
 */
@Slf4j
@Service
public class ExternalIntegrationWebhookDispatcher {

    public static final Long DEFAULT_WORKSPACE_ID = 1L;

    public static final String EVENT_DRIFT_HIGH_CRITICAL = "DRIFT_HIGH_CRITICAL";
    public static final String EVENT_REVIEW_SUBMITTED = "REVIEW_SUBMITTED";
    public static final String EVENT_DOCUMENT_PUBLISHED = "DOCUMENT_PUBLISHED";
    public static final String EVENT_TEST_CONNECTION = "TEST_CONNECTION";

    public static final String SLACK_COLOR_DRIFT = "#e01e5a";
    public static final String SLACK_COLOR_REVIEW = "#ecb22e";
    public static final String SLACK_COLOR_PUBLISHED = "#36a64f";

    public static final int DISCORD_COLOR_RED = 14768474;
    public static final int DISCORD_COLOR_BLUE = 3447003;
    public static final int DISCORD_COLOR_GREEN = 3066993;

    private final SpringDataExternalIntegrationRepository integrationRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository repositoryRepository;

    @Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository documentRepository;

    @Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.security.TenantAccessService tenantAccessService;

    @Autowired
    public ExternalIntegrationWebhookDispatcher(
            SpringDataExternalIntegrationRepository integrationRepository,
            ObjectMapper objectMapper) {
        this(integrationRepository, objectMapper, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(6))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build());
    }

    public ExternalIntegrationWebhookDispatcher(
            SpringDataExternalIntegrationRepository integrationRepository,
            ObjectMapper objectMapper,
            HttpClient httpClient) {
        this.integrationRepository = integrationRepository;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    /**
     * Bắn thông báo bất đồng bộ khi phát hiện Drift HIGH hoặc CRITICAL.
     */
    public void dispatchDriftAlert(Long repositoryId, Long documentId, String severity, String details, String sourceRef) {
        String normSeverity = severity != null ? severity.trim().toUpperCase(Locale.ROOT) : "";
        if (!"HIGH".equals(normSeverity) && !"CRITICAL".equals(normSeverity)) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("severity", normSeverity);
        data.put("repositoryId", repositoryId);
        if (documentId != null) {
            data.put("documentId", documentId);
        }
        if (StringUtils.hasText(sourceRef)) {
            data.put("sourceRef", sourceRef);
        }
        data.put("details", StringUtils.hasText(details) ? details : "Phát hiện sai lệch tài liệu và mã nguồn mức " + normSeverity);

        String title = String.format("[%s] Cảnh báo sai lệch tài liệu (Doc Drift)", normSeverity);
        String summary = String.valueOf(data.get("details"));

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Mức độ", normSeverity);
        fields.put("Repository ID", String.valueOf(repositoryId));
        if (documentId != null) {
            fields.put("Document ID", String.valueOf(documentId));
        }
        if (StringUtils.hasText(sourceRef)) {
            fields.put("Nguồn", sourceRef);
        }

        Long targetWorkspaceId = resolveWorkspaceIdForEvent(repositoryId, documentId);
        dispatchAsync(targetWorkspaceId, EVENT_DRIFT_HIGH_CRITICAL, title, summary, SLACK_COLOR_DRIFT, DISCORD_COLOR_RED, fields, data);
    }

    /**
     * Bắn thông báo bất đồng bộ khi Developer gửi tài liệu cho Staff duyệt.
     */
    public void dispatchReviewSubmitted(Long docId, String docTitle, Long actorId, String status) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("docId", docId);
        data.put("title", docTitle);
        data.put("actorId", actorId);
        data.put("status", status != null ? status : "UNDER_REVIEW_STAFF");

        String title = "Tài liệu mới được gửi duyệt (Staff Review)";
        String summary = String.format("Tài liệu \"%s\" (#%d) đã được gửi lên hàng đợi Staff xem xét.",
                StringUtils.hasText(docTitle) ? docTitle : "Tài liệu #" + docId, docId);

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Tài liệu", StringUtils.hasText(docTitle) ? docTitle : "#" + docId);
        fields.put("Document ID", String.valueOf(docId));
        fields.put("Trạng thái", String.valueOf(data.get("status")));
        if (actorId != null) {
            fields.put("Người gửi (ID)", String.valueOf(actorId));
        }

        Long targetWorkspaceId = resolveWorkspaceIdForEvent(null, docId);
        dispatchAsync(targetWorkspaceId, EVENT_REVIEW_SUBMITTED, title, summary, SLACK_COLOR_REVIEW, DISCORD_COLOR_BLUE, fields, data);
    }

    /**
     * Bắn thông báo bất đồng bộ khi tài liệu được Manager phê duyệt xuất bản (PUBLISHED).
     */
    public void dispatchDocumentPublished(Long docId, String docTitle, Long actorId, String commitSha) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("docId", docId);
        data.put("title", docTitle);
        data.put("actorId", actorId);
        data.put("status", "PUBLISHED");
        if (StringUtils.hasText(commitSha)) {
            data.put("commitSha", commitSha);
        }

        String title = "Tài liệu đã được xuất bản (PUBLISHED)";
        String summary = String.format("Tài liệu \"%s\" (#%d) đã được phê duyệt và xuất bản chính thức.",
                StringUtils.hasText(docTitle) ? docTitle : "Tài liệu #" + docId, docId);

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Tài liệu", StringUtils.hasText(docTitle) ? docTitle : "#" + docId);
        fields.put("Document ID", String.valueOf(docId));
        fields.put("Trạng thái", "PUBLISHED");
        if (StringUtils.hasText(commitSha)) {
            fields.put("Git Commit SHA", commitSha);
        }

        Long targetWorkspaceId = resolveWorkspaceIdForEvent(null, docId);
        dispatchAsync(targetWorkspaceId, EVENT_DOCUMENT_PUBLISHED, title, summary, SLACK_COLOR_PUBLISHED, DISCORD_COLOR_GREEN, fields, data);
    }

    private Long resolveWorkspaceIdForEvent(Long repositoryId, Long documentId) {
        try {
            if (repositoryId != null && repositoryRepository != null) {
                var repoOpt = repositoryRepository.findById(repositoryId);
                if (repoOpt.isPresent() && repoOpt.get().getWorkspaceId() != null) {
                    return repoOpt.get().getWorkspaceId();
                }
            }
            if (documentId != null && documentRepository != null && repositoryRepository != null) {
                var docOpt = documentRepository.findById(documentId);
                if (docOpt.isPresent() && docOpt.get().getRepoId() != null) {
                    var repoOpt = repositoryRepository.findById(docOpt.get().getRepoId());
                    if (repoOpt.isPresent() && repoOpt.get().getWorkspaceId() != null) {
                        return repoOpt.get().getWorkspaceId();
                    }
                }
            }
            if (tenantAccessService != null) {
                var scope = tenantAccessService.currentScope();
                if (scope.workspaceId() != null) {
                    return scope.workspaceId();
                }
            }
        } catch (Exception ex) {
            log.debug("[WebhookDispatcher] Không thể phân giải workspaceId cho sự kiện: {}", ex.getMessage());
        }
        // Chỉ fallback DEFAULT_WORKSPACE_ID khi chạy unit test không có repository beans
        return (repositoryRepository == null && documentRepository == null) ? DEFAULT_WORKSPACE_ID : null;
    }

    private void dispatchAsync(
            Long targetWorkspaceId,
            String eventType,
            String title,
            String summary,
            String slackColor,
            int discordColor,
            Map<String, String> fields,
            Map<String, Object> customData) {
        if (integrationRepository == null || targetWorkspaceId == null) {
            return;
        }
        // Đọc danh sách tích hợp đã bật của ĐÚNG doanh nghiệp sở hữu sự kiện (tránh rò rỉ cross-tenant)
        List<ExternalIntegrationEntity> enabledIntegrations;
        try {
            enabledIntegrations = integrationRepository.findByWorkspaceIdAndEnabledTrue(targetWorkspaceId);
        } catch (Exception ex) {
            log.warn("[WebhookDispatcher] Không thể truy vấn external_integrations: {}", ex.getMessage());
            return;
        }
        if (enabledIntegrations == null || enabledIntegrations.isEmpty()) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            for (ExternalIntegrationEntity entity : enabledIntegrations) {
                try {
                    Map<String, Object> cfg = parseConfig(entity.getConfigJson());
                    String webhookUrl = asString(cfg.get("webhookUrl"));
                    if (!StringUtils.hasText(webhookUrl)) {
                        continue;
                    }
                    if (!isEventSubscribed(cfg, eventType)) {
                        continue;
                    }
                    String secret = asString(cfg.get("secret"));
                    String payload = buildPayloadForProvider(
                            entity.getProvider(),
                            eventType,
                            title,
                            summary,
                            slackColor,
                            discordColor,
                            fields,
                            customData
                    );
                    WebhookSendResult result = sendHttpWebhook(webhookUrl, secret, payload);
                    if (result.statusCode() >= 200 && result.statusCode() < 300) {
                        log.info("[WebhookDispatcher] Đã gửi sự kiện {} tới {} (HTTP {})",
                                eventType, entity.getProvider(), result.statusCode());
                    } else {
                        log.warn("[WebhookDispatcher] Gửi sự kiện {} tới {} nhận HTTP {}: {}",
                                eventType, entity.getProvider(), result.statusCode(), result.responseBody());
                    }
                } catch (Exception ex) {
                    log.warn("[WebhookDispatcher] Lỗi gửi webhook cho provider {} (event={}): {}",
                            entity.getProvider(), eventType, ex.getMessage());
                }
            }
        });
    }

    public String buildPayloadForProvider(
            String provider,
            String eventType,
            String title,
            String summary,
            String slackColor,
            int discordColor,
            Map<String, String> fields,
            Map<String, Object> customData) throws Exception {
        String p = provider != null ? provider.trim().toUpperCase(Locale.ROOT) : "CUSTOM_WEBHOOK";
        if ("SLACK".equals(p)) {
            return buildSlackPayload(title, summary, slackColor, fields);
        } else if ("DISCORD".equals(p)) {
            return buildDiscordPayload(title, summary, discordColor, fields);
        } else {
            return buildCustomWebhookPayload(eventType, customData != null ? customData : Map.of("title", title, "summary", summary));
        }
    }

    public String buildSlackPayload(String title, String summary, String colorHex, Map<String, String> fields) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("text", "*" + title + "*\n" + summary);

        List<Map<String, Object>> blocks = new ArrayList<>();
        blocks.add(Map.of(
                "type", "header",
                "text", Map.of("type", "plain_text", "text", truncate(title, 150))
        ));
        blocks.add(Map.of(
                "type", "section",
                "text", Map.of("type", "mrkdwn", "text", summary)
        ));
        payload.put("blocks", blocks);

        List<Map<String, Object>> attachmentFields = new ArrayList<>();
        if (fields != null) {
            for (Map.Entry<String, String> entry : fields.entrySet()) {
                attachmentFields.add(Map.of(
                        "title", entry.getKey(),
                        "value", entry.getValue() != null ? entry.getValue() : "",
                        "short", true
                ));
            }
        }

        Map<String, Object> attachment = new LinkedHashMap<>();
        attachment.put("color", StringUtils.hasText(colorHex) ? colorHex : SLACK_COLOR_PUBLISHED);
        attachment.put("title", title);
        attachment.put("text", summary);
        attachment.put("fields", attachmentFields);
        attachment.put("footer", "LivingDocs Notification Engine");
        attachment.put("ts", Instant.now().getEpochSecond());

        payload.put("attachments", List.of(attachment));
        return objectMapper.writeValueAsString(payload);
    }

    public String buildDiscordPayload(String title, String summary, int colorDecimal, Map<String, String> fields) throws Exception {
        List<Map<String, Object>> embedFields = new ArrayList<>();
        if (fields != null) {
            for (Map.Entry<String, String> entry : fields.entrySet()) {
                embedFields.add(Map.of(
                        "name", entry.getKey(),
                        "value", entry.getValue() != null ? entry.getValue() : "-",
                        "inline", true
                ));
            }
        }

        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", truncate(title, 256));
        embed.put("description", truncate(summary, 2048));
        embed.put("color", colorDecimal);
        embed.put("fields", embedFields);
        embed.put("timestamp", Instant.now().toString());
        embed.put("footer", Map.of("text", "LivingDocs Webhook Dispatcher"));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("username", "LivingDocs Bot");
        payload.put("embeds", List.of(embed));
        return objectMapper.writeValueAsString(payload);
    }

    public String buildCustomWebhookPayload(String eventType, Map<String, Object> data) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", eventType);
        payload.put("timestamp", Instant.now().toString());
        payload.put("data", data != null ? data : Collections.emptyMap());
        return objectMapper.writeValueAsString(payload);
    }

    public WebhookSendResult sendHttpWebhook(String webhookUrl, String secret, String jsonBody) {
        long start = System.currentTimeMillis();
        try {
            URI uri = URI.create(webhookUrl.trim());
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .header("User-Agent", "LivingDocs-Webhook-Dispatcher/1.0");

            if (StringUtils.hasText(secret)) {
                String signature = computeHmacSha256(jsonBody, secret.trim());
                reqBuilder.header("X-LivingDocs-Signature", "sha256=" + signature);
            }

            HttpRequest request = reqBuilder
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            long latency = System.currentTimeMillis() - start;
            return new WebhookSendResult(
                    response.statusCode() >= 200 && response.statusCode() < 300,
                    response.statusCode(),
                    response.body() != null ? response.body() : "",
                    latency,
                    null
            );
        } catch (Exception ex) {
            long latency = System.currentTimeMillis() - start;
            return new WebhookSendResult(false, 0, "", latency, ex.getMessage());
        }
    }

    private boolean isEventSubscribed(Map<String, Object> cfg, String eventType) {
        Object rawEvents = cfg.get("events");
        if (!(rawEvents instanceof Collection<?> list) || list.isEmpty()) {
            return true;
        }
        for (Object item : list) {
            if (item != null && eventType.equalsIgnoreCase(item.toString().trim())) {
                return true;
            }
        }
        return false;
    }

    private Map<String, Object> parseConfig(String configJson) {
        if (!StringUtils.hasText(configJson)) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(configJson, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private String asString(Object val) {
        return val != null ? val.toString().trim() : null;
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }

    public static String computeHmacSha256(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(bytes);
    }

    public record WebhookSendResult(boolean success, int statusCode, String responseBody, long latencyMs, String errorMessage) {
    }
}
