package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateReviewCommentRequest {

    @Schema(description = "Trạng thái nhận xét mới (OPEN hoặc RESOLVED)", example = "RESOLVED")
    private String status;

    @Schema(description = "Nội dung nhận xét cập nhật (tùy chọn)", example = "Đã cập nhật theo hướng dẫn")
    private String detailedComment;
}
