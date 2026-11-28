package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.*;

import java.util.List;

/** Use-case Quản trị người dùng dành cho vai trò ADMIN & Quản lý cấp lại mật khẩu. */
public interface AdminUserServicePort {
    List<AdminUserResponse> listUsers();
    List<AdminUserResponse> listUsers(String status, Long enterpriseId, Boolean unassigned);
    AdminUserResponse createUser(AdminCreateUserRequest request, Long actorId, String actorEmail);
    AdminUserResponse approveUser(Long userId, AdminApproveUserRequest request, Long actorId, String actorEmail);
    AdminUserResponse rejectUser(Long userId, AdminRejectUserRequest request, Long actorId, String actorEmail);
    AdminUserResponse assignUserEnterprise(Long userId, Long enterpriseId, Long actorId, String actorEmail);
    AdminUserResponse changeRole(Long userId, String role, Long actorId, String actorEmail);
    AdminUserResponse changeStatus(Long userId, boolean active, Long actorId, String actorEmail);

    /** Người dùng gửi yêu cầu quên mật khẩu lên cho Admin duyệt */
    PasswordResetRequestResponse requestPasswordReset(ForgotPasswordRequest request);

    /** Admin xem danh sách các yêu cầu cấp lại mật khẩu */
    List<PasswordResetRequestResponse> listPasswordResetRequests();

    /** Admin trực tiếp cấp lại mật khẩu cho người dùng theo requestId hoặc userId */
    PasswordResetRequestResponse approvePasswordReset(Long requestId, AdminResetPasswordRequest request, Long adminId, String adminEmail);

    /** Admin đặt lại mật khẩu trực tiếp cho bất kỳ tài khoản người dùng nào */
    AdminUserResponse directResetPassword(Long userId, String newPassword, Long adminId, String adminEmail);
}
