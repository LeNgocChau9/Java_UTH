package com.example.livingdocs_backend.application.dto.github;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

/**
 * Request DTO khi thêm một Repository vào Workspace.
 */
@Builder
public record CreateRepoRequest(
        Long workspaceId,

        @NotBlank(message = "repoFullName không được để trống (ví dụ: owner/repo-name)")
        String repoFullName,

        String repoName,
        Long githubRepoId,
        String defaultBranch,
        String cloneUrl,
        String githubToken
) {}
