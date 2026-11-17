package com.example.livingdocs_backend.application.dto.integration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExternalIntegrationDto {
    private Long integrationId;
    private String provider;
    private Long workspaceId;
    private boolean enabled;
    private String webhookUrl;
    private String channelName;
    private String apiBaseUrl;
    private String secret;
    private String apiToken;
    private boolean secretConfigured;
    private List<String> events;
    private Map<String, Object> extraConfig;
    private Long updatedBy;
    private Instant updatedAt;
}
