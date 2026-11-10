package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO kết quả dọn dẹp nhật ký kiểm toán và lịch sử thay đổi (thủ công hoặc tự động).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả dọn dẹp nhật ký kiểm toán và lịch sử thay đổi quá hạn")
public class AuditCleanupResultDto {

    @Schema(description = "Số bản ghi nhật ký kiểm toán (audit_logs) đã xóa an toàn", example = "120")
    private long auditLogsDeleted;

    @Schema(description = "Số bản ghi lịch sử thay đổi (changelogs) đã xóa an toàn", example = "45")
    private long changelogsDeleted;

    @Schema(description = "Mốc thời gian cutoff: Các bản ghi tạo trước thời điểm này đã được dọn sạch")
    private Instant cutoffTime;

    @Schema(description = "Số ngày lưu trữ được áp dụng", example = "90")
    private int retentionDaysApplied;

    @Schema(description = "Thời điểm thực hiện dọn dẹp")
    private Instant executedAt;

    @Schema(description = "Phương thức thực thi (MANUAL hoặc SCHEDULED_AUTO)", example = "MANUAL")
    private String triggerMethod;

    @Schema(description = "Thông báo kết quả", example = "Dọn dẹp thành công 165 bản ghi quá hạn 90 ngày")
    private String message;
}

