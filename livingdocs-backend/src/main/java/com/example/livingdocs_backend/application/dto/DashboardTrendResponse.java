package com.example.livingdocs_backend.application.dto;

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
@Schema(description = "Chuỗi tuần phục vụ biểu đồ lịch sử tài liệu")
public class DashboardTrendResponse {

    @Schema(description = "Kho được lọc. Null nghĩa là toàn hệ thống.")
    private Long repositoryId;

    @Schema(description = "Số tuần trả về, tuần hiện tại là phần tử cuối", example = "12")
    private int weeks;

    private List<DashboardTrendPoint> points;
}
