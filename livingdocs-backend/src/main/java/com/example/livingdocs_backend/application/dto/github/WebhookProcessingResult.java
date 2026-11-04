package com.example.livingdocs_backend.application.dto.github;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;

/**
 * DTO kết quả sau khi tiếp nhận và xử lý webhook từ GitHub.
 * Bóc tách và trả về đầy đủ các thông tin: repository full name, PR number,
 * base commit SHA, head commit SHA, tác giả commit.
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WebhookProcessingResult(
                boolean success,
                String eventType,
                String action,
                String repoFullName,
                Integer prNumber,
                String baseCommitSha,
                String headCommitSha,
                String commitAuthor,
                int affectedCount,
                String message) {
}
