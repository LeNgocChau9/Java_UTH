package com.example.livingdocs_backend.application.dto.github;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO đại diện cho kết quả gửi Check Run / Commit Status lên GitHub.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubCheckRunResultDto {
    private Long checkRunId;
    private String name;
    private String headSha;
    private String status;      // "queued", "in_progress", "completed"
    private String conclusion;  // "success", "failure", "neutral", "action_required", "timed_out"
    private String title;
    private String summary;
    private String detailsUrl;
    private String htmlUrl;
    private Instant completedAt;
}

