package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO cấu hình chính sách lưu trữ (Retention Policy) cho nhật ký kiểm toán và lịch sử thay đổi.
 * Hỗ trợ các mốc thời gian từ 30 ngày đến 365 ngày (1 năm).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Cấu hình chính sách lưu trữ nhật ký kiểm toán và lịch sử thay đổi")
public class AuditRetentionConfigDto {

    @Min(value = 30, message = "Thời hạn lưu trữ tối thiểu là 30 ngày")
    @Max(value = 365, message = "Thời hạn lưu trữ tối đa là 365 ngày (1 năm)")
    @Schema(description = "Số ngày lưu trữ nhật ký kiểm toán và lịch sử thay đổi (30 đến 365 ngày)", example = "90")
    @Builder.Default
    private Integer retentionDays = 90;

    @Schema(description = "Trạng thái tự động kích hoạt dọn dẹp định kỳ", example = "true")
    @Builder.Default
    private Boolean autoCleanupEnabled = true;

    @Schema(description = "Biểu thức cron cho tiến trình chạy nền định kỳ (mặc định 02:00 sáng mỗi ngày)", example = "0 0 2 * * ?")
    @Builder.Default
    private String cleanupCron = "0 0 2 * * ?";

    @Schema(description = "Thời điểm dọn dẹp gần nhất")
    private Instant lastCleanupAt;

    @Schema(description = "Trạng thái dọn dẹp gần nhất (SUCCESS, FAILED, NEVER_RUN)")
    private String lastCleanupStatus;

    @Schema(description = "Số bản ghi nhật ký kiểm toán đã xóa trong lần dọn dẹp gần nhất")
    private Long lastAuditLogsDeleted;

    @Schema(description = "Số bản ghi lịch sử thay đổi (changelogs) đã xóa trong lần dọn dẹp gần nhất")
    private Long lastChangelogsDeleted;

    @Schema(description = "Người cập nhật cấu hình gần nhất (User ID)")
    private Long updatedBy;

    @Schema(description = "Thời điểm cập nhật cấu hình gần nhất")
    private Instant updatedAt;
}

