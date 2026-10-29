package com.example.livingdocs_backend.application.dto.drift;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAlertResponseDto {
    private Long alertId;
    private Long repoId;
    private String repoName;
    private Integer prNumber;
    private String filePath;
    private String severity;
    private String diffSnippet;
    private String status;
    private Long documentId;
    private String documentTitle;
    private String currentDocContent;
    private String methodName;
    private String changeType;
    private String aiSuggestion;
    private Instant createdAt;
    private Instant resolvedAt;
}

