package com.example.livingdocs_backend.application.dto.health;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Đánh giá mức độ tuân thủ của dự án theo các thang điểm chuẩn")
public class ProjectComplianceDto {

    @Schema(description = "Thang điểm tuân thủ tổng thể trên thang 100", example = "88.5")
    private double overallScore;

    @Schema(description = "Xếp hạng mức độ tuân thủ: EXCELLENT (A+), GOOD (A), MODERATE (B), POOR (C), CRITICAL (D)", example = "GOOD")
    private String rating;

    @Schema(description = "Điểm thành phần độ bao phủ (trên 100)", example = "85.0")
    private double coverageScore;

    @Schema(description = "Điểm thành phần độ mới (trên 100)", example = "92.0")
    private double freshnessScore;

    @Schema(description = "Điểm thành phần kiểm soát sai lệch (trên 100, trừ dần theo mức độ rủi ro của cảnh báo)", example = "88.5")
    private double driftControlScore;

    @Schema(description = "Tóm tắt nhận định tình trạng tuân thủ", example = "Dự án đạt chuẩn tốt. Độ mới và độ bao phủ cao, cần giải quyết các cảnh báo trôi dạt mức độ trung bình.")
    private String summary;

    @Schema(description = "Danh sách các khuyến nghị cải thiện chất lượng tài liệu")
    private List<String> recommendations;
}
