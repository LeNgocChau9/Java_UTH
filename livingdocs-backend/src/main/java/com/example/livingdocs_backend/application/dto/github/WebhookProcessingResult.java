package com.example.livingdocs_backend.application.dto.github;

import lombok.Builder;

/**
 * DTO kết quả sau khi xử lý webhook từ GitHub.
 */
@Builder
public record WebhookProcessingResult(
        boolean success,
        String eventType,
        String repoFullName,
        int affectedCount,
        String message
) {}
