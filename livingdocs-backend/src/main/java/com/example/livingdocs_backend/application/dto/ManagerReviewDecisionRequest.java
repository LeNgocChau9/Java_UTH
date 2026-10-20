package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Yêu cầu quyết định phê duyệt cấp 2 của Manager.
 * - decision: "APPROVE" (chuyển sang PUBLISHED hoặc APPROVED) hoặc "REJECT" (chuyển sang REJECTED).
 * - comment: Lý do phê duyệt, ghi chú hoặc lý do từ chối gửi lại cho tác giả/nhân viên.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerReviewDecisionRequest {

    @Schema(description = "Quyết định của Manager: APPROVE (chuyển sang PUBLISHED) hoặc REJECT (chuyển sang REJECTED)", example = "APPROVE")
    private String decision;

    @Schema(description = "Ghi chú/Nhận xét của Manager hoặc lý do từ chối", example = "Tài liệu đạt chuẩn chất lượng, đồng ý xuất bản.")
    private String comment;
}
