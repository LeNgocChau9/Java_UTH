package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu gửi lên Admin xin cấp lại mật khẩu")
public class ForgotPasswordRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không đúng định dạng")
    @Schema(description = "Email tài khoản cần khôi phục mật khẩu", example = "user@example.com")
    private String email;

    @Schema(description = "Lý do hoặc ghi chú gửi kèm Admin", example = "Tôi quên mật khẩu sau khi đổi máy tính")
    private String note;
}
