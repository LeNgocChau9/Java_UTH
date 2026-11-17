package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateReviewCommentRequest {

    @Schema(description = "ID đợt xem xét (tùy chọn)", example = "10")
    private Long reviewId;

    @Schema(description = "Đoạn văn bản hoặc tiêu đề được bôi đen nhận xét", example = "## 1. Tổng quan kiến trúc")
    private String textSegment;

    @NotBlank(message = "Nội dung nhận xét không được để trống")
    @Schema(description = "Nội dung nhận xét chi tiết", example = "Cần giải thích rõ hơn về luồng xác thực JWT")
    private String detailedComment;

    @Schema(description = "Email người nhận xét (tùy chọn, tự suy từ token nếu bỏ trống)", example = "staff@livingdocs.internal")
    private String authorEmail;

    @Schema(description = "Vai trò người nhận xét (tùy chọn, tự suy từ token nếu bỏ trống)", example = "STAFF")
    private String authorRole;
}
