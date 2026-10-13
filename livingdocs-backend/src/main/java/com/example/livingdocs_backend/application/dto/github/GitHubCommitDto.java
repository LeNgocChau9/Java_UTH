package com.example.livingdocs_backend.application.dto.github;

import lombok.Builder;

import java.time.Instant;
import java.util.List;

/**
 * DTO biểu diễn thông tin Commit từ GitHub REST API.
 */
@Builder
public record GitHubCommitDto(
        String sha,
        String message,
        String authorName,
        String authorEmail,
        Instant authorDate,
        String committerName,
        String committerEmail,
        Instant committerDate,
        String htmlUrl,
        List<String> parentShas
) {}
