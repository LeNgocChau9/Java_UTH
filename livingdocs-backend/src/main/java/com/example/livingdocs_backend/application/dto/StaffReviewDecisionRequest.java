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
public class StaffReviewDecisionRequest {

    @Schema(description = "Quyết định của Staff: APPROVE (chuyển sang UNDER_REVIEW_MANAGER) hoặc REJECT (chuyển sang REJECTED)", example = "APPROVE")
    private String decision;

    @Schema(description = "Ghi chú/Nhận xét của Staff (Review comment) hoặc lý do từ chối gửi lại tác giả", example = "Đã rà soát đối chiếu xong AST và cấu trúc code, tài liệu đạt chuẩn.")
    private String comment;
}
