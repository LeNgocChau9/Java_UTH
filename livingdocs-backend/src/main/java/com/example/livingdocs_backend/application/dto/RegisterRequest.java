package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    @Schema(example = "dev_new@livingdocs.internal")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    @Schema(example = "Password@123")
    private String password;

    @NotBlank(message = "Họ và tên không được để trống")
    @Schema(example = "Tran Van Newbie")
    private String fullName;

    @Schema(example = "https://api.dicebear.com/7.x/avataaars/svg?seed=newbie")
    private String avatarUrl;
}
