package com.example.livingdocs_backend.application.dto.drift;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload chứa thông tin Pull Request cần quét Drift trong hàng đợi ngầm (JobQueue).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrDriftScanJobPayload {
    private Long repositoryId;
    private String repoFullName;
    private int prNumber;
    private String prTitle;
    private String authorUsername;
    private String headCommitHash;
    private String baseCommitHash;
    private String action;
}
