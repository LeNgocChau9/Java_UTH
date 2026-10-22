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
public class ManagerActionRequest {

    @Schema(description = "Hành động của Manager: APPROVE / PUBLISH (Phê duyệt xuất bản -> PUBLISHED) hoặc REJECT / RETURN (Trả về -> REJECTED)", example = "APPROVE")
    private String action;

    @Schema(description = "Bí danh tương đương với action: APPROVE hoặc REJECT", example = "APPROVE")
    private String decision;

    @Schema(description = "Ghi chú / Nhận xét của Manager hoặc lý do trả về", example = "Phê duyệt xuất bản chính thức lên wiki hệ thống.")
    private String comment;

    @Schema(description = "Bí danh tương đương với comment", example = "Phê duyệt xuất bản")
    private String note;

    @Schema(description = "Vai trò người thực hiện (tùy chọn nếu đã đăng nhập JWT)", example = "MANAGER")
    private String actorRole;
}
