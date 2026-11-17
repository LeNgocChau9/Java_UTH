package com.example.livingdocs_backend.application.dto;

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
public class ReviewCommentDto {

    @Schema(description = "ID của nhận xét", example = "1")
    private Long commentId;

    @Schema(description = "ID đợt xem xét (nếu có)", example = "10")
    private Long reviewId;

    @Schema(description = "ID tài liệu", example = "100")
    private Long docId;

    @Schema(description = "Đoạn văn bản hoặc tiêu đề được bôi đen nhận xét", example = "## 1. Tổng quan kiến trúc")
    private String textSegment;

    @Schema(description = "Nội dung nhận xét chi tiết", example = "Cần bổ sung sơ đồ sequence diagram")
    private String detailedComment;

    @Schema(description = "Trạng thái nhận xét: OPEN hoặc RESOLVED", example = "OPEN")
    private String status;

    @Schema(description = "Email người nhận xét", example = "staff@livingdocs.internal")
    private String authorEmail;

    @Schema(description = "Vai trò người nhận xét", example = "STAFF")
    private String authorRole;

    @Schema(description = "Thời gian tạo nhận xét")
    private Instant createdAt;

    @Schema(description = "Thời gian cập nhật / khắc phục")
    private Instant updatedAt;
}
