package com.example.livingdocs_backend.application.dto;

import com.example.livingdocs_backend.domain.model.DocumentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewActionResponse {

    @Schema(description = "ID tài liệu", example = "6")
    private Long id;

    @Schema(description = "ID tài liệu (alias)", example = "6")
    private Long docId;

    @Schema(description = "ID bản ghi xem xét trong bảng reviews", example = "1")
    private Long reviewId;

    @Schema(description = "Tiêu đề tài liệu", example = "Hướng dẫn Kiến trúc Hệ thống")
    private String title;

    @Schema(description = "Trạng thái mới sau khi xử lý", example = "UNDER_REVIEW_MANAGER")
    private DocumentStatus status;

    @Schema(description = "Số phiên bản hiện tại", example = "1")
    private Integer currentVersion;

    @Schema(description = "Hành động đã xử lý", example = "APPROVE")
    private String action;

    @Schema(description = "Người xem xét / phê duyệt", example = "staff@livingdocs.internal")
    private String reviewer;

    @Schema(description = "Ghi chú / Nhận xét đã lưu", example = "Đã đối chiếu AST thành công.")
    private String comment;

    @Schema(description = "Thông báo kết quả xử lý", example = "Staff đã duyệt tài liệu thành công và chuyển sang Manager (UNDER_REVIEW_MANAGER).")
    private String message;

    @Schema(description = "Chi tiết tài liệu sau khi cập nhật trạng thái")
    private DocumentResponse document;

    @Schema(description = "Thời điểm thực hiện")
    private Instant timestamp;
}
