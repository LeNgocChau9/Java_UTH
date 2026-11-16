package com.example.livingdocs_backend.application.dto.ai;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiSettingDto(
        @JsonAlias({"cloudProvider", "cloud_provider"})
        String cloudProvider,

        @JsonAlias({"apiKey", "api_key", "keyAi", "key_ai"})
        String apiKey,

        @JsonAlias({"localAiUrl", "local_ai_url"})
        String localAiUrl,

        @JsonAlias({"localModel", "local_model"})
        String localModel,

        @JsonAlias({"routingMode", "routing_mode"})
        String routingMode,

        @JsonAlias({"provider"})
        String provider
) {
    /**
     * Đồng bộ giá trị provider ("ollama", "gemini", hoặc "auto") tương thích với yeu-cau-sinh-tai-lieu
     */
    public String resolveProvider() {
        if (provider != null && !provider.isBlank()) {
            return provider;
        }
        if ("local_only".equalsIgnoreCase(routingMode) || "ollama".equalsIgnoreCase(routingMode)) {
            return "ollama";
        }
        if ("cloud_only".equalsIgnoreCase(routingMode) || "gemini".equalsIgnoreCase(routingMode)) {
            return "gemini";
        }
        return "auto";
    }
}
