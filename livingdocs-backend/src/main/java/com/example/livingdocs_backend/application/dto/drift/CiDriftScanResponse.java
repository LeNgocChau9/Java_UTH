package com.example.livingdocs_backend.application.dto.drift;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response trả về cho GitHub Action sau khi nhận và xử lý quét Drift.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CiDriftScanResponse {

    @Schema(description = "Trạng thái tiếp nhận: SUCCESS, FAILED", example = "SUCCESS")
    private String status;

    @Schema(description = "Thông báo kết quả", example = "Đã tiếp nhận và lưu thành công 3 cảnh báo trôi dạt vào bảng drift_alerts")
    private String message;

    @Schema(description = "ID của repository", example = "1")
    private Long repoId;

    @Schema(description = "Số Pull Request", example = "42")
    private Integer prNumber;

    @Schema(description = "Tổng số cảnh báo đã ghi nhận", example = "3")
    private int totalAlertsRecorded;

    @Schema(description = "Thời gian tiếp nhận", example = "2026-10-29T07:35:00Z")
    private Instant receivedAt;

    @Schema(description = "Danh sách ID các alert vừa được tạo")
    private List<Long> alertIds;
}

