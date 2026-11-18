package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.integration.ExternalIntegrationDto;
import com.example.livingdocs_backend.application.dto.integration.TestExternalIntegrationRequest;
import com.example.livingdocs_backend.application.dto.integration.TestExternalIntegrationResponse;
import com.example.livingdocs_backend.application.dto.integration.UpdateExternalIntegrationRequest;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.notification.ExternalIntegrationWebhookDispatcher;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ExternalIntegrationEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataExternalIntegrationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExternalIntegrationService {

    public static final Long DEFAULT_WORKSPACE_ID = 1L;
    public static final List<String> CORE_WEBHOOK_PROVIDERS = List.of("SLACK", "DISCORD", "CUSTOM_WEBHOOK");
    public static final List<String> DEFAULT_EVENTS = List.of(
            ExternalIntegrationWebhookDispatcher.EVENT_DRIFT_HIGH_CRITICAL,
            ExternalIntegrationWebhookDispatcher.EVENT_REVIEW_SUBMITTED,
            ExternalIntegrationWebhookDispatcher.EVENT_DOCUMENT_PUBLISHED
    );

    private final SpringDataExternalIntegrationRepository integrationRepository;
    private final ExternalIntegrationWebhookDispatcher webhookDispatcher;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private AuditServicePort auditServicePort;

    @Transactional(readOnly = true)
    public List<ExternalIntegrationDto> listIntegrations(Long workspaceId) {
        Long wsId = workspaceId != null ? workspaceId : DEFAULT_WORKSPACE_ID;
        List<ExternalIntegrationEntity> existing = integrationRepository.findByWorkspaceIdOrderByProviderAsc(wsId);

        Map<String, ExternalIntegrationEntity> byProvider = new LinkedHashMap<>();
        for (ExternalIntegrationEntity e : existing) {
            if (e.getProvider() != null) {
                byProvider.put(e.getProvider().toUpperCase(Locale.ROOT), e);
            }
        }

        List<ExternalIntegrationDto> result = new ArrayList<>();
        for (String core : CORE_WEBHOOK_PROVIDERS) {
            ExternalIntegrationEntity entity = byProvider.remove(core);
            result.add(entity != null ? toDto(entity) : defaultDto(core, wsId));
        }
        // Bao gồm các provider mở rộng khác nếu đã được lưu trong CSDL (vd: CONFLUENCE, NOTION)
        for (ExternalIntegrationEntity extra : byProvider.values()) {
            result.add(toDto(extra));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public ExternalIntegrationDto getIntegration(String provider, Long workspaceId) {
        String normalizedProvider = normalizeProvider(provider);
        Long wsId = workspaceId != null ? workspaceId : DEFAULT_WORKSPACE_ID;
        return integrationRepository.findByProviderAndWorkspaceId(normalizedProvider, wsId)
                .map(this::toDto)
                .orElseGet(() -> defaultDto(normalizedProvider, wsId));
    }

    @Transactional
    public ExternalIntegrationDto upsertIntegration(
            String provider,
            UpdateExternalIntegrationRequest request,
            Long actorId,
            Long workspaceId) {
        String normalizedProvider = normalizeProvider(provider);
        Long wsId = workspaceId != null
                ? workspaceId
                : (request != null && request.getWorkspaceId() != null ? request.getWorkspaceId() : DEFAULT_WORKSPACE_ID);

        ExternalIntegrationEntity entity = integrationRepository
                .findByProviderAndWorkspaceId(normalizedProvider, wsId)
                .orElseGet(() -> ExternalIntegrationEntity.builder()
                        .provider(normalizedProvider)
                        .workspaceId(wsId)
                        .enabled(false)
                        .configJson("{}")
                        .secretConfigured(false)
                        .build());

        Map<String, Object> existingConfig = parseConfig(entity.getConfigJson());
        Map<String, Object> nextConfig = new LinkedHashMap<>(existingConfig);

        if (request != null) {
            if (request.getEnabled() != null) {
                entity.setEnabled(request.getEnabled());
            }
            if (request.getWebhookUrl() != null) {
                String cleanUrl = request.getWebhookUrl().trim();
                if (!cleanUrl.isEmpty()) {
                    validateHttpUrl(cleanUrl, "webhookUrl");
                    nextConfig.put("webhookUrl", cleanUrl);
                } else {
                    nextConfig.remove("webhookUrl");
                }
            }
            if (request.getChannelName() != null) {
                nextConfig.put("channelName", request.getChannelName().trim());
            }
            if (request.getApiBaseUrl() != null) {
                String baseUrl = request.getApiBaseUrl().trim();
                if (!baseUrl.isEmpty()) {
                    validateHttpUrl(baseUrl, "apiBaseUrl");
                    nextConfig.put("apiBaseUrl", baseUrl);
                } else {
                    nextConfig.remove("apiBaseUrl");
                }
            }
            if (request.getSecret() != null) {
                String sec = request.getSecret().trim();
                if (!AiRuntimeConfigService.isMasked(sec)) {
                    if (sec.isEmpty()) {
                        nextConfig.remove("secret");
                    } else {
                        nextConfig.put("secret", sec);
                    }
                }
            }
            if (request.getApiToken() != null) {
                String tok = request.getApiToken().trim();
                if (!AiRuntimeConfigService.isMasked(tok)) {
                    if (tok.isEmpty()) {
                        nextConfig.remove("apiToken");
                    } else {
                        nextConfig.put("apiToken", tok);
                    }
                }
            }
            if (request.getEvents() != null) {
                List<String> normalizedEvents = request.getEvents().stream()
                        .filter(StringUtils::hasText)
                        .map(s -> s.trim().toUpperCase(Locale.ROOT))
                        .distinct()
                        .toList();
                nextConfig.put("events", normalizedEvents);
            } else if (!nextConfig.containsKey("events")) {
                nextConfig.put("events", DEFAULT_EVENTS);
            }
            if (request.getExtraConfig() != null) {
                nextConfig.put("extraConfig", request.getExtraConfig());
            }
        }

        boolean hasSecretOrWebhook = StringUtils.hasText(asString(nextConfig.get("webhookUrl")))
                || StringUtils.hasText(asString(nextConfig.get("secret")))
                || StringUtils.hasText(asString(nextConfig.get("apiToken")));

        try {
            entity.setConfigJson(objectMapper.writeValueAsString(nextConfig));
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tuần tự hóa cấu hình JSON: " + ex.getMessage(), ex);
        }
        entity.setSecretConfigured(hasSecretOrWebhook);
        entity.setUpdatedBy(actorId);
        entity.setUpdatedAt(Instant.now());

        ExternalIntegrationEntity saved = integrationRepository.save(entity);

        if (auditServicePort != null) {
            try {
                auditServicePort.recordSecurityAction(
                        actorId,
                        AuditAction.USER_UPDATED,
                        "EXTERNAL_INTEGRATION",
                        normalizedProvider,
                        String.format("Cập nhật tích hợp ngoài %s (workspace=%d, enabled=%s)",
                                normalizedProvider, wsId, saved.isEnabled())
                );
            } catch (Exception ex) {
                log.warn("[ExternalIntegration] Ghi audit log thất bại: {}", ex.getMessage());
            }
        }

        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public TestExternalIntegrationResponse testConnection(TestExternalIntegrationRequest request, Long workspaceId) {
        if (request == null || !StringUtils.hasText(request.getProvider())) {
            throw new IllegalArgumentException("Provider không được để trống");
        }
        String provider = normalizeProvider(request.getProvider());
        Long wsId = workspaceId != null
                ? workspaceId
                : (request.getWorkspaceId() != null ? request.getWorkspaceId() : DEFAULT_WORKSPACE_ID);

        String targetUrl = request.getWebhookUrl() != null ? request.getWebhookUrl().trim() : "";
        String secret = request.getSecret() != null ? request.getSecret().trim() : "";

        Optional<ExternalIntegrationEntity> storedOpt = integrationRepository.findByProviderAndWorkspaceId(provider, wsId);
        if (storedOpt.isPresent()) {
            Map<String, Object> storedCfg = parseConfig(storedOpt.get().getConfigJson());
            if (!StringUtils.hasText(targetUrl)) {
                targetUrl = asString(storedCfg.get("webhookUrl"));
            }
            if (!StringUtils.hasText(secret) || AiRuntimeConfigService.isMasked(secret)) {
                secret = asString(storedCfg.get("secret"));
            }
        }

        if (!StringUtils.hasText(targetUrl)) {
            throw new IllegalArgumentException("Webhook URL không được để trống để kiểm tra kết nối");
        }
        validateHttpUrl(targetUrl, "webhookUrl");

        String testTitle = "LivingDocs — Kiểm tra kết nối " + provider;
        String testSummary = StringUtils.hasText(request.getMessage())
                ? request.getMessage().trim()
                : "Kết nối tích hợp từ LivingDocs hoạt động bình thường! Đây là thông báo thử nghiệm.";

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Provider", provider);
        fields.put("Workspace ID", String.valueOf(wsId));
        fields.put("Trạng thái", "TEST_CONNECTION");

        Map<String, Object> customData = new LinkedHashMap<>();
        customData.put("provider", provider);
        customData.put("workspaceId", wsId);
        customData.put("message", testSummary);

        String payload;
        try {
            payload = webhookDispatcher.buildPayloadForProvider(
                    provider,
                    ExternalIntegrationWebhookDispatcher.EVENT_TEST_CONNECTION,
                    testTitle,
                    testSummary,
                    ExternalIntegrationWebhookDispatcher.SLACK_COLOR_PUBLISHED,
                    ExternalIntegrationWebhookDispatcher.DISCORD_COLOR_GREEN,
                    fields,
                    customData
            );
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tạo payload kiểm tra: " + ex.getMessage(), ex);
        }

        ExternalIntegrationWebhookDispatcher.WebhookSendResult result =
                webhookDispatcher.sendHttpWebhook(targetUrl, secret, payload);

        String message = result.success()
                ? String.format("Kết nối %s thành công (HTTP %d, %d ms)", provider, result.statusCode(), result.latencyMs())
                : (result.statusCode() > 0
                        ? String.format("Webhook %s trả về lỗi HTTP %d", provider, result.statusCode())
                        : "Không thể kết nối tới Webhook URL: " + (result.errorMessage() != null ? result.errorMessage() : "Lỗi mạng"));

        return TestExternalIntegrationResponse.builder()
                .success(result.success())
                .provider(provider)
                .statusCode(result.statusCode())
                .responseBody(result.responseBody())
                .latencyMs(result.latencyMs())
                .message(message)
                .build();
    }

    /**
     * Lấy cấu hình thô (bao gồm apiToken/apiBaseUrl) dùng nội bộ cho bộ nạp MCP.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getRawConfig(String provider, Long workspaceId) {
        String norm = normalizeProvider(provider);
        Long wsId = workspaceId != null ? workspaceId : DEFAULT_WORKSPACE_ID;
        return integrationRepository.findByProviderAndWorkspaceId(norm, wsId)
                .map(e -> parseConfig(e.getConfigJson()))
                .orElseGet(Collections::emptyMap);
    }

    private ExternalIntegrationDto toDto(ExternalIntegrationEntity entity) {
        Map<String, Object> cfg = parseConfig(entity.getConfigJson());
        List<String> events = extractEvents(cfg.get("events"));
        Map<String, Object> extra = cfg.get("extraConfig") instanceof Map<?, ?> m
                ? convertMap(m)
                : Collections.emptyMap();

        String rawSecret = asString(cfg.get("secret"));
        String rawToken = asString(cfg.get("apiToken"));

        return ExternalIntegrationDto.builder()
                .integrationId(entity.getIntegrationId())
                .provider(entity.getProvider())
                .workspaceId(entity.getWorkspaceId())
                .enabled(entity.isEnabled())
                .webhookUrl(asString(cfg.get("webhookUrl")))
                .channelName(asString(cfg.get("channelName")))
                .apiBaseUrl(asString(cfg.get("apiBaseUrl")))
                .secret(StringUtils.hasText(rawSecret) ? AiRuntimeConfigService.maskApiKey(rawSecret) : "")
                .apiToken(StringUtils.hasText(rawToken) ? AiRuntimeConfigService.maskApiKey(rawToken) : "")
                .secretConfigured(entity.isSecretConfigured())
                .events(events)
                .extraConfig(extra)
                .updatedBy(entity.getUpdatedBy())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private ExternalIntegrationDto defaultDto(String provider, Long wsId) {
        return ExternalIntegrationDto.builder()
                .provider(provider)
                .workspaceId(wsId)
                .enabled(false)
                .webhookUrl("")
                .channelName("")
                .apiBaseUrl("")
                .secret("")
                .apiToken("")
                .secretConfigured(false)
                .events(new ArrayList<>(DEFAULT_EVENTS))
                .extraConfig(Collections.emptyMap())
                .build();
    }

    private String normalizeProvider(String provider) {
        if (!StringUtils.hasText(provider)) {
            throw new IllegalArgumentException("Tên provider không được để trống");
        }
        return provider.trim().toUpperCase(Locale.ROOT);
    }

    private void validateHttpUrl(String url, String fieldName) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                throw new IllegalArgumentException(fieldName + " phải bắt đầu bằng http:// hoặc https://");
            }
            if (!StringUtils.hasText(uri.getHost())) {
                throw new IllegalArgumentException(fieldName + " không có tên miền hợp lệ");
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(fieldName + " không đúng định dạng URL: " + ex.getMessage());
        }
    }

    private Map<String, Object> parseConfig(String json) {
        if (!StringUtils.hasText(json)) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private List<String> extractEvents(Object raw) {
        if (raw instanceof Collection<?> col && !col.isEmpty()) {
            List<String> list = new ArrayList<>();
            for (Object item : col) {
                if (item != null && StringUtils.hasText(item.toString())) {
                    list.add(item.toString().trim().toUpperCase(Locale.ROOT));
                }
            }
            if (!list.isEmpty()) {
                return list;
            }
        }
        return new ArrayList<>(DEFAULT_EVENTS);
    }

    private Map<String, Object> convertMap(Map<?, ?> raw) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : raw.entrySet()) {
            if (entry.getKey() != null) {
                map.put(entry.getKey().toString(), entry.getValue());
            }
        }
        return map;
    }

    private String asString(Object val) {
        return val != null ? val.toString().trim() : null;
    }
}
