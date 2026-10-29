package com.example.livingdocs_backend.application.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardTrendItemDto {
    /** Nhãn biểu đồ (ví dụ: "Tuần 1", "Tuần 2", "PR #135"...) */
    private String label;

    /** Ngày/mốc thời gian */
    private String period;

    /** Số lượng tài liệu đã cập nhật / tạo mới */
    private Integer updatedDocs;

    /** Số lượng cảnh báo Drift phát hiện */
    private Integer driftAlerts;

    /** Tỷ lệ bao phủ đạt được tại mốc đó (%) */
    private Double coverageRate;
}

