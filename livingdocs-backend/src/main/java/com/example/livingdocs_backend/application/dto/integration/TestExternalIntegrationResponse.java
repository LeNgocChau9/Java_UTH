package com.example.livingdocs_backend.application.dto.integration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestExternalIntegrationResponse {
    private boolean success;
    private String provider;
    private int statusCode;
    private String responseBody;
    private long latencyMs;
    private String message;
}
