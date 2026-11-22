package com.example.livingdocs_backend.application.dto.policy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentUpdatePolicyDto {
    private Long policyId;
    private String documentType;
    private Boolean triggerCommit;
    private Boolean triggerPullRequest;
    private Boolean triggerMerge;
    private String action; // AUTO_UPDATE vs REVIEW
    private Long updatedBy;
    private Instant updatedAt;
}
