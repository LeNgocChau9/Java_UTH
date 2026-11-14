package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO cấu hình tùy chọn nhận thông báo từ hệ thống của người dùng.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Cấu hình tùy chọn nhận thông báo của người dùng cá nhân")
public class UserNotificationPreferencesDto {

    @Schema(description = "ID người dùng", example = "1")
    private Long userId;

    @Schema(description = "Bật/tắt nhận thông báo qua Email tổng quát", example = "true")
    private Boolean emailEnabled;

    @Schema(description = "Bật/tắt nhận thông báo khi có tài liệu mới cần duyệt (Review Queue / Approval)", example = "true")
    private Boolean reviewEnabled;

    @Schema(description = "Bật/tắt nhận thông báo khi phát hiện cảnh báo sai lệch mã nguồn (Drift Alert / Document)", example = "true")
    private Boolean driftAlertEnabled;

    @Schema(description = "Alias tương thích với cột document_enabled (nhận thông báo tài liệu & cảnh báo sai lệch)", example = "true")
    private Boolean documentEnabled;

    @Schema(description = "Bật/tắt nhận thông báo khi mã khóa truy cập GitHub gặp sự cố cần cấp quyền lại", example = "true")
    private Boolean githubTokenIssueEnabled;

    @Schema(description = "Alias tương thích với cột github_enabled (nhận thông báo sự cố token GitHub)", example = "true")
    private Boolean githubEnabled;

    @Schema(description = "Thời điểm cập nhật cấu hình thông báo gần nhất")
    private Instant updatedAt;
}
