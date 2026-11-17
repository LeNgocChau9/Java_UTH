package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceManagerResponse {

    @Schema(description = "ID người dùng", example = "3")
    private Long userId;

    @Schema(description = "Họ và tên", example = "Nguyen Van Manager")
    private String fullName;

    @Schema(description = "Email đăng nhập", example = "manager@livingdocs.internal")
    private String email;

    @Schema(description = "Danh sách vai trò", example = "[\"MANAGER\"]")
    private Set<String> roles;
}
