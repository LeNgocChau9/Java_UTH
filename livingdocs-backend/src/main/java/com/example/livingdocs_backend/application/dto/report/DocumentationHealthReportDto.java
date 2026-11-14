package com.example.livingdocs_backend.application.dto.report;

import com.example.livingdocs_backend.application.dto.RepoCoverageDto;
import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto;
import com.example.livingdocs_backend.application.dto.health.ProjectComplianceDto;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * DTO đại diện cho báo cáo tình trạng sức khỏe tài liệu của repository hoặc toàn hệ thống.
 */
@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Schema(description = "Báo cáo tổng hợp tình trạng sức khỏe tài liệu")
public class DocumentationHealthReportDto extends DocumentHealthReportResponse {

    @Builder(builderMethodName = "dtoBuilder")
    public DocumentationHealthReportDto(Long repositoryId,
                                        String repositoryName,
                                        Instant generatedAt,
                                        long executionTimeMs,
                                        boolean readyForScan,
                                        Boolean hasData,
                                        String overallRating,
                                        double coveragePercent,
                                        long totalScannedEntities,
                                        long documentedEntities,
                                        double freshnessPercent,
                                        Instant latestCommitAt,
                                        long totalDocuments,
                                        long freshDocuments,
                                        MissingDocEntityStatsDto missingDocEntities,
                                        long totalOpenDriftAlerts,
                                        Map<String, Long> openAlertsBySeverity,
                                        ProjectComplianceDto compliance,
                                        List<RepoCoverageDto> repositoryDetails) {
        super(repositoryId, repositoryName, generatedAt, executionTimeMs,
                readyForScan, hasData, overallRating,
                coveragePercent, totalScannedEntities, documentedEntities,
                freshnessPercent, latestCommitAt, totalDocuments, freshDocuments,
                missingDocEntities, totalOpenDriftAlerts, openAlertsBySeverity,
                compliance, repositoryDetails);
    }
}
