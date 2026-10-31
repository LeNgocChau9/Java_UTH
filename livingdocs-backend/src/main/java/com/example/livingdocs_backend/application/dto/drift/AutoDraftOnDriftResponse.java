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
public class AutoDraftOnDriftResponse {
    private Long alertId;
    private Long documentId;
    private Long versionId;
    private Integer versionNum;
    private String status; // DRAFT
    private String actorRole; // AI
    private String triggerType; // AUTO_DRIFT_AI_REWRITE
    private String summaryOfChanges;
    private String message;
    private Instant createdAt;
}

