package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Tỷ lệ bao phủ tài liệu theo từng kho mã nguồn")
public class RepoCoverageDto {
    private Long repoId;
    private String repoName;
    private double coveragePercent;
    private long totalEntities;
    private long documentedEntities;
    private long openDriftCount;
}

