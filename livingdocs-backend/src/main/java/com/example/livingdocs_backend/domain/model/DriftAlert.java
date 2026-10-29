package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Domain Model đại diện cho một cảnh báo sai lệch tài liệu (Drift Alert).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAlert {
    private Long alertId;
    private Long repoId;
    private Integer prNumber;
    private String filePath;
    private String severity;
    private String diffSnippet;
    private String status;
    private Long documentId;
    private String methodName;
    private String changeType;
    private Instant createdAt;
    private Instant resolvedAt;
}
