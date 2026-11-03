package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.AdminResetPasswordRequest;
import com.example.livingdocs_backend.application.dto.AdminUserResponse;
import com.example.livingdocs_backend.application.dto.ForgotPasswordRequest;
import com.example.livingdocs_backend.application.dto.PasswordResetRequestResponse;

import java.util.List;

/** Use-case Quản trị người dùng dành cho vai trò ADMIN & Quản lý cấp lại mật khẩu. */
public interface AdminUserServicePort {
    List<AdminUserResponse> listUsers();
    AdminUserResponse createUser(com.example.livingdocs_backend.application.dto.AdminCreateUserRequest request, Long actorId, String actorEmail);
    AdminUserResponse changeRole(Long userId, String role, Long actorId, String actorEmail);
    AdminUserResponse changeStatus(Long userId, boolean active);

    /** Người dùng gửi yêu cầu quên mật khẩu lên cho Admin duyệt */
    PasswordResetRequestResponse requestPasswordReset(ForgotPasswordRequest request);

    /** Admin xem danh sách các yêu cầu cấp lại mật khẩu */
    List<PasswordResetRequestResponse> listPasswordResetRequests();

    /** Admin trực tiếp cấp lại mật khẩu cho người dùng theo requestId hoặc userId */
    PasswordResetRequestResponse approvePasswordReset(Long requestId, AdminResetPasswordRequest request, Long adminId, String adminEmail);

    /** Admin đặt lại mật khẩu trực tiếp cho bất kỳ tài khoản người dùng nào */
    AdminUserResponse directResetPassword(Long userId, String newPassword, Long adminId, String adminEmail);
}
