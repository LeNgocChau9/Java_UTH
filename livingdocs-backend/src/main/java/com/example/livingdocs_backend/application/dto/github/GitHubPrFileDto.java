package com.example.livingdocs_backend.application.dto.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

/**
 * DTO đại diện cho một file bị thay đổi trong Pull Request từ GitHub API.
 */
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubPrFileDto(
                String sha,
                String filename,
                String status, // "added", "removed", "modified", "renamed"
                @JsonProperty("previous_filename") String previousFilename,
                String patch,
                @JsonProperty("raw_url") String rawUrl) {
}
