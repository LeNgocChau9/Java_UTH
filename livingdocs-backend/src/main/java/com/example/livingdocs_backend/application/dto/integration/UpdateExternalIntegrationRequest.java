package com.example.livingdocs_backend.application.dto.integration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateExternalIntegrationRequest {
    private Long workspaceId;
    private Boolean enabled;
    private String webhookUrl;
    private String channelName;
    private String apiBaseUrl;
    private String secret;
    private String apiToken;
    private List<String> events;
    private Map<String, Object> extraConfig;
}
