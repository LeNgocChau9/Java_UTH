package com.example.livingdocs_backend.application.dto.github;

import lombok.Builder;

import java.time.Instant;

/**
 * Response DTO trả về thông tin Repository sau khi thêm hoặc truy vấn.
 */
@Builder
public record RepoResponse(
        Long repositoryId,
        Long workspaceId,
        Long connectionId,
        Long githubRepoId,
        String repoName,
        String repoFullName,
        String defaultBranch,
        String cloneUrl,
        Boolean isActive,
        Boolean autoDocEnabled,
        Instant lastSyncedAt,
        Instant createdAt,
        Instant updatedAt
) {}
