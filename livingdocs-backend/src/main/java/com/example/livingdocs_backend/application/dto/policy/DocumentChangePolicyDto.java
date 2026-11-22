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
public class DocumentChangePolicyDto {
    private Long policyId;
    private Long workspaceId;
    private Long repositoryId;
    private String modulePattern;
    private String documentType;
    private Integer threshold;
    private Boolean autoUpdateEnabled;
    private Long updatedBy;
    private Instant updatedAt;
}
