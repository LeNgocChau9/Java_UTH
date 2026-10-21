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
public class StaffActionRequest {

    @Schema(description = "Hành động của Staff: APPROVE (chuyển sang UNDER_REVIEW_MANAGER) hoặc REJECT (chuyển sang REJECTED)", example = "APPROVE")
    private String action;

    @Schema(description = "Bí danh tương đương với action", example = "APPROVE")
    private String decision;

    @Schema(description = "Ghi chú / Nhận xét của Staff hoặc lý do từ chối gửi lại tác giả", example = "Đã rà soát đối chiếu xong AST và mã nguồn, tài liệu đạt chuẩn.")
    private String comment;

    @Schema(description = "Bí danh tương đương với comment", example = "Đã đối chiếu AST")
    private String note;

    @Schema(description = "Vai trò người thực hiện (tùy chọn nếu đã đăng nhập JWT)", example = "STAFF")
    private String actorRole;
}
