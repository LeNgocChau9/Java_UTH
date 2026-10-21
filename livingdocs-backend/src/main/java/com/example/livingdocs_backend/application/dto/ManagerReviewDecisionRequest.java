package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Yêu cầu quyết định phê duyệt cấp 2 của Manager.
 * - decision: "PUBLISH" / "APPROVE" (chuyển sang PUBLISHED), "RETURN_STAFF" (trả lại Staff sang UNDER_REVIEW_STAFF), hoặc "REJECT" (chuyển sang REJECTED).
 * - comment: Lý do phê duyệt, ghi chú hoặc lý do trả lại / từ chối.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerReviewDecisionRequest {

    @Schema(description = "Quyết định của Manager: PUBLISH / APPROVE (xuất bản), RETURN_STAFF (trả lại Staff) hoặc REJECT (từ chối)", example = "PUBLISH")
    private String decision;

    @Schema(description = "Ghi chú/Nhận xét của Manager hoặc lý do từ chối/trả lại Staff", example = "Tài liệu đạt chuẩn chất lượng, đồng ý xuất bản lên GitHub.")
    private String comment;
}
