package com.example.livingdocs_backend.application.dto.job;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DriftAnalyzeJobPayload {
    private String mode;
    private Long repositoryId;
    private Integer prNumber;
    private Long documentId;
    private String baseSha;
    private String headSha;
    private Long actorId;
}
