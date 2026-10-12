package com.example.livingdocs_backend.application.dto.github;

import lombok.Builder;

/**
 * DTO biểu diễn một file hoặc thư mục trong GitHub Repository (Git Tree / Content).
 */
@Builder
public record GitHubFileDto(
        String path,
        String mode,
        String type,      // "blob" (file) hoặc "tree" (folder)
        String sha,
        Long size,
        String url
) {
    public boolean isFile() {
        return "blob".equalsIgnoreCase(type);
    }

    public boolean isDirectory() {
        return "tree".equalsIgnoreCase(type);
    }
}
