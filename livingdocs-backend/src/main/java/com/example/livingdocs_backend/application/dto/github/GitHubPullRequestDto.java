package com.example.livingdocs_backend.application.dto.github;

import lombok.Builder;

import java.time.Instant;

/**
 * DTO biểu diễn thông tin Pull Request từ GitHub REST API.
 */
@Builder
public record GitHubPullRequestDto(
        Long id,
        Integer number,
        String title,
        String body,
        String state,          // "open", "closed"
        String headBranch,
        String headCommitSha,
        String baseBranch,
        String baseCommitSha,
        String authorLogin,
        String authorAvatarUrl,
        String htmlUrl,
        Boolean merged,
        Instant createdAt,
        Instant updatedAt,
        Instant closedAt,
        Instant mergedAt
) {}
