package com.example.livingdocs_backend.application.dto.job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAnalyzeJobPayload {
    private Long repositoryId;
    private Integer prNumber;
    private String baseSha;
    private String headSha;
    private Long actorId;
}
