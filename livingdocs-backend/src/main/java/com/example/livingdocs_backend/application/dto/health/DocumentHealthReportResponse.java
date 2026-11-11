package com.example.livingdocs_backend.application.dto.health;

import com.example.livingdocs_backend.application.dto.RepoCoverageDto;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Báo cáo tổng hợp tình trạng sức khỏe tài liệu toàn diện")
public class DocumentHealthReportResponse {

    @Schema(description = "ID kho được thống kê (null nếu thống kê toàn hệ thống)", example = "1")
    private Long repositoryId;

    @Schema(description = "Tên kho được thống kê (null nếu toàn hệ thống)", example = "livingdocs/backend")
    private String repositoryName;

    @Schema(description = "Thời điểm tạo báo cáo")
    private Instant generatedAt;

    @Schema(description = "Thời gian xử lý báo cáo (mili-giây, tiêu chuẩn dưới 300ms)", example = "45")
    private long executionTimeMs;

    // 1. Độ bao phủ mã nguồn
    @Schema(description = "Tỷ lệ bao phủ mã nguồn (%)", example = "82.5")
    private double coveragePercent;

    @Schema(description = "Tổng số phần tử (classes, methods, functions) đã quét", example = "120")
    private long totalScannedEntities;

    @Schema(description = "Số phần tử đã được tài liệu hóa", example = "99")
    private long documentedEntities;

    // 2. Độ mới theo commit mới nhất
    @Schema(description = "Tỷ lệ độ mới theo commit mới nhất (%)", example = "88.0")
    private double freshnessPercent;

    @Schema(description = "Thời điểm commit mới nhất trong phạm vi thống kê")
    private Instant latestCommitAt;

    @Schema(description = "Tổng số tài liệu", example = "25")
    private long totalDocuments;

    @Schema(description = "Số tài liệu cập nhật kịp thời so với commit mới nhất", example = "22")
    private long freshDocuments;

    // 3. Số lượng hàm và lớp còn thiếu tài liệu
    @Schema(description = "Thống kê chi tiết các hàm và lớp còn thiếu tài liệu")
    private MissingDocEntityStatsDto missingDocEntities;

    // 4. Phân loại chi tiết các cảnh báo sai lệch từ thấp đến nghiêm trọng
    @Schema(description = "Tổng số cảnh báo trôi dạt (drift alerts) đang mở", example = "4")
    private long totalOpenDriftAlerts;

    @Schema(description = "Phân loại chi tiết cảnh báo mở theo mức độ nghiêm trọng: LOW, MEDIUM, HIGH, CRITICAL")
    private Map<String, Long> openAlertsBySeverity;

    // 5. Đánh giá mức độ tuân thủ của toàn dự án
    @Schema(description = "Đánh giá mức độ tuân thủ theo các thang điểm chuẩn")
    private ProjectComplianceDto compliance;

    // 6. Thông tin phân rã theo từng kho (khi xem toàn hệ thống)
    @Schema(description = "Danh sách chi tiết sức khỏe và bao phủ theo từng kho")
    private List<RepoCoverageDto> repositoryDetails;
}
