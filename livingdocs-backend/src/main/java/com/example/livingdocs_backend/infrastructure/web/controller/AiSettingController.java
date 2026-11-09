package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ai.AiSettingDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class AiSettingController {

    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final ObjectMapper objectMapper;
    public static final String AI_SETTING_KEY = "ai_configuration";

    @GetMapping("/ai")
    public ResponseEntity<AiSettingDto> getAiSettings() {
        return adminSettingRepository.findById(AI_SETTING_KEY)
                .map(entity -> {
                    try {
                        Map<String, Object> map = objectMapper.readValue(entity.getSettingValue(), Map.class);
                        return ResponseEntity.ok(AiSettingDto.builder()
                                .cloudProvider((String) map.getOrDefault("cloudProvider", "gemini"))
                                .apiKey((String) map.getOrDefault("apiKey", ""))
                                .localAiUrl((String) map.getOrDefault("localAiUrl", "http://127.0.0.1:11434"))
                                .localModel((String) map.getOrDefault("localModel", "qwen2.5-coder:7b"))
                                .routingMode((String) map.getOrDefault("routingMode", "auto"))
                                .build());
                    } catch (Exception e) {
                        log.warn("Lỗi đọc cấu hình AI từ admin_settings: {}", e.getMessage());
                        return ResponseEntity.ok(defaultSettings());
                    }
                })
                .orElseGet(() -> ResponseEntity.ok(defaultSettings()));
    }

    @PostMapping("/ai")
    public ResponseEntity<AiSettingDto> saveAiSettings(@RequestBody AiSettingDto dto) {
        try {
            Map<String, Object> map = new HashMap<>();
            map.put("cloudProvider", StringUtils.hasText(dto.cloudProvider()) ? dto.cloudProvider().trim() : "gemini");
            map.put("apiKey", dto.apiKey() != null ? dto.apiKey().trim() : "");
            map.put("localAiUrl", StringUtils.hasText(dto.localAiUrl()) ? dto.localAiUrl().trim() : "http://127.0.0.1:11434");
            map.put("localModel", StringUtils.hasText(dto.localModel()) ? dto.localModel().trim() : "qwen2.5-coder:7b");
            map.put("routingMode", StringUtils.hasText(dto.routingMode()) ? dto.routingMode().trim() : "auto");

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
            log.info("[AiSettingController] Đã lưu cấu hình AI: cloudProvider={}, routingMode={}, localModel={}",
                    map.get("cloudProvider"), map.get("routingMode"), map.get("localModel"));
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("Lỗi lưu cấu hình AI vào admin_settings: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/ai/scan-local-models")
    public ResponseEntity<Map<String, Object>> scanLocalModels(@RequestParam(name = "url", required = false) String customUrl) {
        String baseUrl = StringUtils.hasText(customUrl) ? customUrl.trim() : "http://127.0.0.1:11434";
        String tagsUrl = baseUrl.replaceAll("/+$", "") + "/api/tags";

        log.info("[AiSettingController] Đang quét model AI Local tại {}", tagsUrl);
        try {
            var requestFactory = new org.springframework.http.client.JdkClientHttpRequestFactory(
                    java.net.http.HttpClient.newBuilder()
                            .version(java.net.http.HttpClient.Version.HTTP_1_1)
                            .connectTimeout(Duration.ofSeconds(3))
                            .build()
            );

            RestClient client = RestClient.builder()
                    .requestFactory(requestFactory)
                    .build();

            String responseBody = client.get()
                    .uri(URI.create(tagsUrl))
                    .retrieve()
                    .body(String.class);

            List<String> models = new ArrayList<>();
            if (StringUtils.hasText(responseBody)) {
                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode modelsNode = root.path("models");
                if (modelsNode.isArray()) {
                    for (JsonNode m : modelsNode) {
                        String name = m.path("name").asText();
                        if (StringUtils.hasText(name)) {
                            models.add(name);
                        }
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("status", "SUCCESS");
            result.put("connected", true);
            result.put("models", models);
            result.put("count", models.size());
            return ResponseEntity.ok(result);

        } catch (Exception ex) {
            log.warn("[AiSettingController] Không thể kết nối quét model tại {}: {}", tagsUrl, ex.getMessage());
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("status", "UNAVAILABLE");
            errorResult.put("connected", false);
            errorResult.put("models", Collections.emptyList());
            errorResult.put("message", "Không thể kết nối đến AI Local (" + ex.getMessage() + "). Hãy kiểm tra xem ứng dụng Ollama đã được mở chưa.");
            return ResponseEntity.ok(errorResult);
        }
    }

    private AiSettingDto defaultSettings() {
        return AiSettingDto.builder()
                .cloudProvider("gemini")
                .apiKey("")
                .localAiUrl("http://127.0.0.1:11434")
                .localModel("qwen2.5-coder:7b")
                .routingMode("auto")
                .build();
    }
}
