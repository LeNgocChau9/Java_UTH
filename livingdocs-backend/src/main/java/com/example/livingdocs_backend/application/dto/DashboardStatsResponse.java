package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Chỉ số sức khỏe tài liệu: độ bao phủ, độ mới và cảnh báo drift đang mở")
public class DashboardStatsResponse {

    @Schema(description = "Kho được lọc. Null nghĩa là toàn hệ thống.", example = "1")
    private Long repositoryId;

    @Schema(description = "Tổng class, method và function đã quét trong code_entities", example = "40")
    private long totalClassesAndFunctions;

    @Schema(description = "Số entity đã có tài liệu (DOCUMENTED hoặc DRIFTED)", example = "25")
    private long documentedEntities;

    @Schema(description = "Tỷ lệ bao phủ = documentedEntities / totalClassesAndFunctions × 100. Bằng 0 khi chưa quét entity nào.", example = "62.5")
    private double coveragePercent;

    @Schema(description = "Tỷ lệ tài liệu còn mới so với commit code mới nhất của cùng repository. Bằng 0 khi chưa có tài liệu.", example = "80.0")
    private double freshnessPercent;

    @Schema(description = "Thời điểm commit code mới nhất trong phạm vi thống kê")
    private Instant latestCommitAt;

    @Schema(description = "Tổng số tài liệu dùng làm mẫu số của freshness", example = "10")
    private long totalDocuments;

    @Schema(description = "Số tài liệu có updated_at không cũ hơn commit mới nhất của repository đó", example = "8")
    private long freshDocuments;

    @Schema(description = "Tổng cảnh báo drift đang OPEN", example = "3")
    private long openDriftAlerts;

    @Schema(description = "Số cảnh báo OPEN theo mức độ. Luôn có LOW, MEDIUM, HIGH, CRITICAL.")
    private Map<String, Long> openAlertsBySeverity;
}
