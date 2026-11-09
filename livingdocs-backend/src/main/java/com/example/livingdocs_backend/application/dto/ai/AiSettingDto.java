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

        @JsonAlias({"routingMode", "routing_mode", "provider"})
        String routingMode
) {}
