package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AiSettingDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Service quản lý và lan truyền cấu hình AI Runtime (R4).
 * Đảm bảo che giấu apiKey khi trả về cho UI và lan truyền tham số tới tất cả REST clients gọi AI Engine.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiRuntimeConfigService {

    public static final String AI_SETTING_KEY = "ai_configuration";

    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final ObjectMapper objectMapper;

    /**
     * Lấy cấu hình AI thô (chứa API Key thật) dùng nội bộ trong backend để gọi AI Engine.
     */
    public AiSettingDto getRawSettings() {
        if (adminSettingRepository == null) {
            return defaultSettings();
        }
        return adminSettingRepository.findById(AI_SETTING_KEY)
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

            AdminSettingEntity entity = adminSettingRepository.findById(AI_SETTING_KEY)
                    .map(existing -> {
                        existing.setSettingValue(json);
                        existing.setUpdatedAt(Instant.now());
                        return existing;
                    })
                    .orElseGet(() -> AdminSettingEntity.builder()
                            .settingKey(AI_SETTING_KEY)
                            .settingValue(json)
                            .updatedAt(Instant.now())
                            .build());

            adminSettingRepository.save(entity);
            log.info("[AiRuntimeConfigService] Đã lưu cấu hình AI thành công: provider={}, routingMode={}, localModel={}",
                    provider, routingMode, localModel);

            return AiSettingDto.builder()
                    .cloudProvider(cloudProvider)
                    .apiKey(maskApiKey(effectiveApiKey))
                    .localAiUrl(localAiUrl)
                    .localModel(localModel)
                    .routingMode(routingMode)
                    .provider(provider)
                    .build();
        } catch (Exception e) {
            log.error("[AiRuntimeConfigService] Lỗi lưu cấu hình AI: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu cấu hình AI: " + e.getMessage(), e);
        }
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
