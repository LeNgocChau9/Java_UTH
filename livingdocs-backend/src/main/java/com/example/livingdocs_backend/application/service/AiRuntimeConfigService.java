package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AiSettingDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service quản lý và lan truyền cấu hình AI Runtime (R4).
 * Hỗ trợ phân tách cấu hình theo doanh nghiệp (ai_configuration:ws:{id}) với fallback về cấu hình chung.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiRuntimeConfigService {

    public static final String AI_SETTING_KEY = "ai_configuration";

    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    private static String workspaceSettingKey(Long workspaceId) {
        return AI_SETTING_KEY + ":ws:" + workspaceId;
    }

    /**
     * Lấy cấu hình AI thô (chứa API Key thật) dùng nội bộ trong backend để gọi AI Engine.
     */
    public AiSettingDto getRawSettings() {
        Long wsId = null;
        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (scope.hasTenantFilter()) {
                wsId = scope.workspaceId();
            }
        }
        return getRawSettingsForWorkspace(wsId);
    }

    public AiSettingDto getRawSettingsForWorkspace(Long workspaceId) {
        if (adminSettingRepository == null) {
            return defaultSettings();
        }
        Optional<AdminSettingEntity> entityOpt = Optional.empty();
        if (workspaceId != null) {
            entityOpt = adminSettingRepository.findById(workspaceSettingKey(workspaceId));
        }
        if (entityOpt.isEmpty()) {
            entityOpt = adminSettingRepository.findById(AI_SETTING_KEY);
        }
        return entityOpt
                .map(entity -> {
                    try {
                        Map<String, Object> map = objectMapper.readValue(entity.getSettingValue(), Map.class);
                        String routing = (String) map.getOrDefault("routingMode", "auto");
                        String cloudProvider = (String) map.getOrDefault("cloudProvider", "gemini");
                        String apiKey = (String) map.getOrDefault("apiKey", "");
                        String localAiUrl = (String) map.getOrDefault("localAiUrl", "http://127.0.0.1:11434");
                        String localModel = (String) map.getOrDefault("localModel", "qwen2.5-coder:7b");

                        String provider = deriveProvider(routing);

                        return AiSettingDto.builder()
                                .cloudProvider(cloudProvider)
                                .apiKey(apiKey)
                                .localAiUrl(localAiUrl)
                                .localModel(localModel)
                                .routingMode(routing)
                                .provider(provider)
                                .build();
                    } catch (Exception e) {
                        log.warn("[AiRuntimeConfigService] Lỗi phân tích cấu hình AI từ DB: {}", e.getMessage());
                        return defaultSettings();
                    }
                })
                .orElseGet(this::defaultSettings);
    }

    /**
     * Lấy cấu hình AI với apiKey đã được che giấu (mask) để trả về cho Frontend GET /api/v1/settings/ai.
     */
    public AiSettingDto getMaskedSettings() {
        AiSettingDto raw = getRawSettings();
        String maskedKey = maskApiKey(raw.apiKey());
        return AiSettingDto.builder()
                .cloudProvider(raw.cloudProvider())
                .apiKey(maskedKey)
                .localAiUrl(raw.localAiUrl())
                .localModel(raw.localModel())
                .routingMode(raw.routingMode())
                .provider(raw.resolveProvider())
                .build();
    }

    /**
     * Lưu cấu hình AI. Nếu apiKey gửi lên là chuỗi che giấu (chứa •• hoặc trống), giữ nguyên key cũ đang lưu trong DB.
     */
    public AiSettingDto saveSettings(AiSettingDto dto) {
        try {
            String targetKey = resolveWriteSettingKey();
            AiSettingDto current = getRawSettings();

            String effectiveApiKey = dto.apiKey() != null ? dto.apiKey().trim() : "";
            // Nếu người dùng không sửa key (key chứa bullet mark) hoặc để trống nhưng trước đó đã có key
            if (isMasked(effectiveApiKey)) {
                effectiveApiKey = current.apiKey();
            }

            String cloudProvider = StringUtils.hasText(dto.cloudProvider()) ? dto.cloudProvider().trim() : "gemini";
            String localAiUrl = StringUtils.hasText(dto.localAiUrl()) ? dto.localAiUrl().trim() : "http://127.0.0.1:11434";
            String localModel = StringUtils.hasText(dto.localModel()) ? dto.localModel().trim() : "qwen2.5-coder:7b";
            String routingMode = StringUtils.hasText(dto.routingMode()) ? dto.routingMode().trim() : "auto";
            String provider = dto.provider() != null && !dto.provider().isBlank() ? dto.provider().trim() : deriveProvider(routingMode);

            Map<String, Object> map = new HashMap<>();
            map.put("cloudProvider", cloudProvider);
            map.put("apiKey", effectiveApiKey);
            map.put("localAiUrl", localAiUrl);
            map.put("localModel", localModel);
            map.put("routingMode", routingMode);
            map.put("provider", provider);

            String json = objectMapper.writeValueAsString(map);

            AdminSettingEntity entity = adminSettingRepository.findById(targetKey)
                    .map(existing -> {
                        existing.setSettingValue(json);
                        existing.setUpdatedAt(Instant.now());
                        return existing;
                    })
                    .orElseGet(() -> AdminSettingEntity.builder()
                            .settingKey(targetKey)
                            .settingValue(json)
                            .updatedAt(Instant.now())
                            .build());

            adminSettingRepository.save(entity);
            log.info("[AiRuntimeConfigService] Đã lưu cấu hình AI (key={}) thành công: provider={}, routingMode={}, localModel={}",
                    targetKey, provider, routingMode, localModel);

            return AiSettingDto.builder()
                    .cloudProvider(cloudProvider)
                    .apiKey(maskApiKey(effectiveApiKey))
                    .localAiUrl(localAiUrl)
                    .localModel(localModel)
                    .routingMode(routingMode)
                    .provider(provider)
                    .build();
        } catch (com.example.livingdocs_backend.domain.exception.AuthenticationException authEx) {
            throw authEx;
        } catch (Exception e) {
            log.error("[AiRuntimeConfigService] Lỗi lưu cấu hình AI: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu cấu hình AI: " + e.getMessage(), e);
        }
    }

    private String resolveWriteSettingKey() {
        if (tenantAccessService == null) {
            return AI_SETTING_KEY;
        }
        var scope = tenantAccessService.currentScope();
        if (scope.systemBypass() || scope.globalAdmin()) {
            return AI_SETTING_KEY;
        }
        Long wsId = tenantAccessService.resolveWriteWorkspaceId(null);
        return workspaceSettingKey(wsId);
    }

    /**
     * Lan truyền runtime settings vào map request body chuẩn bị gửi sang FastAPI AI Engine.
     */
    public void applyRuntimeSettings(Map<String, Object> payload) {
        if (payload == null) {
            return;
        }
        AiSettingDto settings = getRawSettings();
        if (StringUtils.hasText(settings.cloudProvider()) && !payload.containsKey("cloudProvider")) {
            payload.put("cloudProvider", settings.cloudProvider());
        }
        if (StringUtils.hasText(settings.apiKey()) && !payload.containsKey("apiKey")) {
            payload.put("apiKey", settings.apiKey());
        }
        if (StringUtils.hasText(settings.localAiUrl()) && !payload.containsKey("localAiUrl")) {
            payload.put("localAiUrl", settings.localAiUrl());
        }
        if (StringUtils.hasText(settings.localModel()) && !payload.containsKey("localModel")) {
            payload.put("localModel", settings.localModel());
        }
        if (StringUtils.hasText(settings.routingMode()) && !payload.containsKey("routingMode")) {
            payload.put("routingMode", settings.routingMode());
        }
        if (!payload.containsKey("provider")) {
            payload.put("provider", settings.resolveProvider());
        }
    }

    public static String maskApiKey(String key) {
        if (!StringUtils.hasText(key)) {
            return "";
        }
        String clean = key.trim();
        if (clean.length() <= 8) {
            return "••••••••";
        }
        String prefix = clean.substring(0, Math.min(4, clean.length()));
        String suffix = clean.substring(clean.length() - 4);
        return prefix + "••••••••" + suffix;
    }

    public static boolean isMasked(String key) {
        return key == null || key.contains("••") || key.contains("••••") || key.equals("••••••••");
    }

    public static String deriveProvider(String routingMode) {
        if ("local_only".equalsIgnoreCase(routingMode) || "ollama".equalsIgnoreCase(routingMode)) {
            return "ollama";
        }
        if ("cloud_only".equalsIgnoreCase(routingMode) || "gemini".equalsIgnoreCase(routingMode)) {
            return "gemini";
        }
        return "auto";
    }

    public AiSettingDto defaultSettings() {
        return AiSettingDto.builder()
                .cloudProvider("gemini")
                .apiKey("")
                .localAiUrl("http://127.0.0.1:11434")
                .localModel("qwen2.5-coder:7b")
                .routingMode("auto")
                .provider("auto")
                .build();
    }
}
