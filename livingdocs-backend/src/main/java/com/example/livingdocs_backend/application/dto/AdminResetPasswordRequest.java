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
@Schema(description = "Admin cấp lại mật khẩu cho người dùng")
public class AdminResetPasswordRequest {

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Schema(description = "Mật khẩu mới cấp cho người dùng", example = "Canh8533")
    private String newPassword;
}
