package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu cấp lại mật khẩu đang chờ Admin duyệt")
public class PasswordResetRequestResponse {

    @Schema(description = "ID yêu cầu", example = "1")
    private Long requestId;

    @Schema(description = "ID người dùng", example = "2")
    private Long userId;

    @Schema(description = "Email người dùng", example = "nguyenphuccanh8533@gmail.com")
    private String email;

    @Schema(description = "Họ và tên người dùng", example = "Nguyễn Phúc Cảnh")
    private String fullName;

    @Schema(description = "Trạng thái yêu cầu", example = "PENDING")
    private String status;

    @Schema(description = "Thời gian gửi yêu cầu")
    private Instant createdAt;

    @Schema(description = "Thời gian Admin cấp lại mật khẩu")
    private Instant resolvedAt;

    @Schema(description = "Mật khẩu mới do Admin cấp (nếu có)")
    private String newPasswordTemp;
}
