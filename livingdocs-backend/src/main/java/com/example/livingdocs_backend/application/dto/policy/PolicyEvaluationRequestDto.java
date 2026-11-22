package com.example.livingdocs_backend.application.dto.policy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyEvaluationRequestDto {
    private Long repositoryId;
    private Long workspaceId;
    private String documentType;
    private String eventType; // commit, push, pull_request, merge
    private Integer changedFilesCount;
    private String filePath;
}
