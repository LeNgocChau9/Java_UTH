package com.example.livingdocs_backend.application.dto.github;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Phản hồi chi tiết sau khi kiểm tra trạng thái kết nối GitHub Token.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubConnectionStatusResponse {

    private Long connectionId;
    private Long workspaceId;
    private Long userId;
    private String githubUsername;
    private String status; // CONNECTED, EXPIRED, REVOKED
    private boolean valid;
    private String tokenScope;
    private Instant tokenExpiresAt;
    private Instant lastCheckedAt;
    private String warningMessage;
}
