package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Một điểm trên biểu đồ xu hướng theo tuần")
public class DashboardTrendPoint {

    @Schema(description = "Ngày thứ Hai đầu tuần, theo UTC", example = "2026-10-26")
    private LocalDate weekStart;

    @Schema(description = "Số tài liệu tạo mới trong tuần", example = "3")
    private long createdDocuments;

    @Schema(description = "Số lần cập nhật, đếm phiên bản từ version 2 trở đi", example = "5")
    private long updates;

    @Schema(description = "Số cảnh báo drift phát sinh trong tuần", example = "1")
    private long alerts;
}
