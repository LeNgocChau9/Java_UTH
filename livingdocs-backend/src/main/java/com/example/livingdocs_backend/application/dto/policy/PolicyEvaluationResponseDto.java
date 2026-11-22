package com.example.livingdocs_backend.application.dto.policy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyEvaluationResponseDto {
    private String effectiveAction; // AUTO_UPDATE, REVIEW, SKIP
    private String reason;
    private Boolean autoUpdateEnabled;
    private Integer threshold;
    private Integer changedFilesCount;
    private String matchingPattern;
    private DocumentUpdatePolicyDto appliedUpdatePolicy;
    private DocumentChangePolicyDto appliedChangePolicy;
}
