package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAlertResponse {

    private Long alertId;
    private Long documentId;
    private Long repositoryId;
    private String classification;

    @Schema(example = "HIGH")
    private String severity;

    @Schema(example = "RESOLVED")
    private String status;

    private Instant resolvedAt;
}
