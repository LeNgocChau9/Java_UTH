package com.example.livingdocs_backend.application.dto.github;

import lombok.Builder;

import java.time.Instant;

/**
 * Response DTO trả về kết quả đồng bộ Repository từ GitHub về Database.
 */
@Builder
public record SyncRepoResponse(
        Long repositoryId,
        String repoFullName,
        int syncedPullRequestsCount,
        int syncedCommitsCount,
        Instant syncedAt,
        String message
) {}
