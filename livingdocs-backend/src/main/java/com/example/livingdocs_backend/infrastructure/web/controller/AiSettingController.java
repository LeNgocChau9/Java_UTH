package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ai.AiSettingDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    private final com.example.livingdocs_backend.application.service.AiRuntimeConfigService aiRuntimeConfigService;
    private final ObjectMapper objectMapper;
    public static final String AI_SETTING_KEY = "ai_configuration";

    @GetMapping("/ai")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    public ResponseEntity<AiSettingDto> getAiSettings() {
        return ResponseEntity.ok(aiRuntimeConfigService.getMaskedSettings());
    }

    @PostMapping("/ai")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','MANAGER')")
    public ResponseEntity<AiSettingDto> saveAiSettings(@RequestBody AiSettingDto dto) {
        return ResponseEntity.ok(aiRuntimeConfigService.saveSettings(dto));
    }

    @PutMapping("/ai")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','MANAGER')")
    public ResponseEntity<AiSettingDto> updateAiSettings(@RequestBody AiSettingDto dto) {
        return ResponseEntity.ok(aiRuntimeConfigService.saveSettings(dto));
    }

    @GetMapping("/ai/scan-local-models")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
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
