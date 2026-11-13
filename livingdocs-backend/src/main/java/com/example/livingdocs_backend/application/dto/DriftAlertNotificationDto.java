package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAlertNotificationDto {
    private Long alertId;
    private Long repositoryId;
    private Long documentId;
    private String documentTitle;
    private String severity; // CRITICAL, HIGH, MEDIUM, LOW
    private String classification;
    private String status;
    private String sourceCommit;
    private Long sourcePrId;
    private String details;
    private Instant createdAt;
    private String suggestionUrl;
}
