package com.example.livingdocs_backend.application.dto.integration;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestExternalIntegrationRequest {
    @NotBlank(message = "Provider không được để trống (SLACK, DISCORD, CUSTOM_WEBHOOK)")
    private String provider;
    private Long workspaceId;
    private String webhookUrl;
    private String secret;
    private String message;
}
