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
public class CollectionOwnerDto {

    @Schema(description = "ID người dùng", example = "2")
    private Long userId;

    @Schema(description = "Họ và tên", example = "Trần Minh Khoa")
    private String fullName;

    @Schema(description = "Địa chỉ Email", example = "khoa.tran@livingdocs.internal")
    private String email;

    @Schema(description = "Vai trò kỹ thuật (TECH_LEAD, DEVELOPER, STAFF, MANAGER)", example = "TECH_LEAD")
    private String role;

    @Schema(description = "Nhãn hiển thị vai trò", example = "Trưởng nhóm kỹ thuật (Tech Lead)")
    private String roleLabel;

    @Schema(description = "Ảnh đại diện")
    private String avatarUrl;
}
