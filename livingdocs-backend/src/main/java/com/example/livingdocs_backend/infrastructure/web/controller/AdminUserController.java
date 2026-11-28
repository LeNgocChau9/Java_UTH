package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AdminUserServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin - Quản trị người dùng & Phê duyệt", description = "API dành cho ADMIN: xem danh sách, phê duyệt/từ chối đăng ký, gán doanh nghiệp, tạo tài khoản, đổi vai trò, khóa/mở khóa, cấp lại mật khẩu")
public class AdminUserController {

    private final AdminUserServicePort adminUserServicePort;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Danh sách người dùng", description = "Trả về người dùng kèm vai trò, trạng thái và doanh nghiệp. Hỗ trợ lọc theo status, enterpriseId, unassigned. Chỉ ADMIN.")
    public ResponseEntity<List<AdminUserResponse>> listUsers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long enterpriseId,
            @RequestParam(required = false) Boolean unassigned) {
        return ResponseEntity.ok(adminUserServicePort.listUsers(status, enterpriseId, unassigned));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Tạo tài khoản người dùng mới", description = "Chỉ ADMIN mới có quyền tạo tài khoản trực tiếp (ACTIVE ngay), chỉ định vai trò và doanh nghiệp (tùy chọn).")
    public ResponseEntity<AdminUserResponse> createUser(@Valid @RequestBody AdminCreateUserRequest request,
                                                        @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        AdminUserResponse response = adminUserServicePort.createUser(request, actorId, actorEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{userId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Phê duyệt tài khoản chờ duyệt / duyệt lại tài khoản bị từ chối", description = "Chuyển trạng thái sang ACTIVE, tùy chọn gán doanh nghiệp và vai trò.")
    public ResponseEntity<AdminUserResponse> approveUser(
            @PathVariable Long userId,
            @RequestBody(required = false) AdminApproveUserRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminUserServicePort.approveUser(userId, request, actorId, actorEmail));
    }

    @PostMapping("/{userId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Từ chối tài khoản chờ duyệt", description = "Chuyển trạng thái PENDING -> REJECTED kèm lý do từ chối (tùy chọn), giữ lại lịch sử.")
    public ResponseEntity<AdminUserResponse> rejectUser(
            @PathVariable Long userId,
            @RequestBody(required = false) AdminRejectUserRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminUserServicePort.rejectUser(userId, request, actorId, actorEmail));
    }

    @PutMapping("/{userId}/enterprise")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Gán hoặc gỡ doanh nghiệp cho người dùng", description = "Truyền { enterpriseId: number } để gán/chuyển doanh nghiệp, hoặc { enterpriseId: null } để gỡ.")
    public ResponseEntity<AdminUserResponse> assignEnterprise(
            @PathVariable Long userId,
            @RequestBody(required = false) AdminAssignEnterpriseRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        Long enterpriseId = request != null ? request.getEnterpriseId() : null;
        return ResponseEntity.ok(adminUserServicePort.assignUserEnterprise(userId, enterpriseId, actorId, actorEmail));
    }

    @PutMapping("/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Đổi vai trò người dùng", description = "Cập nhật vai trò (DEVELOPER, STAFF, MANAGER, TECH_LEAD, ADMIN) cho người dùng.")
    public ResponseEntity<AdminUserResponse> changeRole(@PathVariable Long userId,
                                                        @RequestParam String role,
                                                        @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminUserServicePort.changeRole(userId, role, actorId, actorEmail));
    }

    @PutMapping("/{userId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Khóa / mở khóa tài khoản", description = "active=true -> mở khóa (ACTIVE); active=false -> khóa (LOCKED).")
    public ResponseEntity<AdminUserResponse> changeStatus(@PathVariable Long userId,
                                                          @RequestParam boolean active,
                                                          @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminUserServicePort.changeStatus(userId, active, actorId, actorEmail));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Gửi yêu cầu quên mật khẩu đến quyền ADMIN", description = "Người dùng nhập email khi quên mật khẩu, hệ thống chuyển yêu cầu này đến danh sách chờ Admin phê duyệt và cấp lại.")
    public ResponseEntity<PasswordResetRequestResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        PasswordResetRequestResponse response = adminUserServicePort.requestPasswordReset(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/password-reset-requests")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Admin xem danh sách yêu cầu cấp lại mật khẩu", description = "Lấy danh sách các yêu cầu cấp lại mật khẩu do người dùng gửi lên.")
    public ResponseEntity<List<PasswordResetRequestResponse>> listPasswordResetRequests() {
        return ResponseEntity.ok(adminUserServicePort.listPasswordResetRequests());
    }

    @PostMapping("/password-reset-requests/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Admin cấp lại mật khẩu theo yêu cầu", description = "Admin phê duyệt và cấp mật khẩu mới cho người dùng theo requestId.")
    public ResponseEntity<PasswordResetRequestResponse> approvePasswordReset(
            @PathVariable Long requestId,
            @Valid @RequestBody AdminResetPasswordRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long adminId = actor != null ? actor.getUserId() : null;
        String adminEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminUserServicePort.approvePasswordReset(requestId, request, adminId, adminEmail));
    }

    @PutMapping("/{userId}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Admin trực tiếp đặt lại mật khẩu cho tài khoản", description = "Admin nhập mật khẩu mới và gán trực tiếp cho bất kỳ tài khoản người dùng nào.")
    public ResponseEntity<AdminUserResponse> directResetPassword(
            @PathVariable Long userId,
            @Valid @RequestBody AdminResetPasswordRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long adminId = actor != null ? actor.getUserId() : null;
        String adminEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminUserServicePort.directResetPassword(userId, request.getNewPassword(), adminId, adminEmail));
    }
}
