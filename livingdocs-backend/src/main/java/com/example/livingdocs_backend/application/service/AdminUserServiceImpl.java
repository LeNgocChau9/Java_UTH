package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AdminUserServicePort;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.EmailAlreadyExistsException;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PasswordResetRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPasswordResetRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserServicePort {

    private final UserRepositoryPort userRepositoryPort;
    private final AuditServicePort auditServicePort;
    private final PasswordEncoder passwordEncoder;
    private final SpringDataPasswordResetRequestRepository passwordResetRequestRepository;

    @Override
    public List<AdminUserResponse> listUsers() {
        return userRepositoryPort.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public AdminUserResponse createUser(AdminCreateUserRequest request, Long actorId, String actorEmail) {
        String email = request.getEmail().toLowerCase().trim();
        if (userRepositoryPort.existsByEmail(email)) {
            throw new EmailAlreadyExistsException("Email '" + email + "' đã tồn tại trong hệ thống");
        }

        RoleType targetRole = RoleType.ROLE_DEVELOPER;
        if (request.getRole() != null && !request.getRole().isBlank()) {
            targetRole = RoleType.fromString(request.getRole());
        }

        User newUser = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .avatarUrl(request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank()
                        ? request.getAvatarUrl().trim()
                        : "https://api.dicebear.com/7.x/avataaars/svg?seed=" + email)
                .status("ACTIVE")
                .build();

        User savedUser = userRepositoryPort.save(newUser);

        // Gán vai trò vào workspace
        userRepositoryPort.changeRole(savedUser.getUserId(), targetRole.getRawName());

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.USER_CREATED,
                    "USER",
                    String.valueOf(savedUser.getUserId()),
                    "Admin (" + actorEmail + ") tạo tài khoản mới: " + email + " với vai trò " + targetRole.getRawName()
            );
        }

        return toResponse(userRepositoryPort.findById(savedUser.getUserId()).orElse(savedUser));
    }

    @Override
    @Transactional
    public AdminUserResponse changeRole(Long userId, String role, Long actorId, String actorEmail) {
        RoleType roleType = RoleType.fromString(role);
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng"));
        String previousRoles = user.getRoles() == null
                ? ""
                : user.getRoles().stream().map(Enum::name).sorted().collect(java.util.stream.Collectors.joining(","));
        userRepositoryPort.changeRole(user.getUserId(), roleType.getRawName());
        auditServicePort.recordRoleChange(actorId, actorEmail, userId, previousRoles, roleType.getRawName());
        return toResponse(userRepositoryPort.findById(userId).orElse(user));
    }

    @Override
    public AdminUserResponse changeStatus(Long userId, boolean active) {
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng"));
        String status = active ? "ACTIVE" : "LOCKED";
        User updated = userRepositoryPort.updateStatus(user.getUserId(), status);
        return toResponse(updated);
    }

    @Override
    @Transactional
    public PasswordResetRequestResponse requestPasswordReset(ForgotPasswordRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        User user = userRepositoryPort.findByEmail(email)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy tài khoản với email: " + email));

        // Kiểm tra xem đã có yêu cầu PENDING chưa
        PasswordResetRequestEntity entity = passwordResetRequestRepository
                .findFirstByEmailAndStatusOrderByCreatedAtDesc(email, "PENDING")
                .orElseGet(() -> PasswordResetRequestEntity.builder()
                        .userId(user.getUserId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .status("PENDING")
                        .createdAt(Instant.now())
                        .build());

        entity.setCreatedAt(Instant.now());
        PasswordResetRequestEntity saved = passwordResetRequestRepository.save(entity);

        log.info("[PasswordReset] Đã tiếp nhận yêu cầu cấp lại mật khẩu cho user={}, email={}. Đang chờ Admin duyệt.",
                user.getUserId(), user.getEmail());

        return toResetResponse(saved);
    }

    @Override
    public List<PasswordResetRequestResponse> listPasswordResetRequests() {
        return passwordResetRequestRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResetResponse)
                .toList();
    }

    @Override
    @Transactional
    public PasswordResetRequestResponse approvePasswordReset(Long requestId, AdminResetPasswordRequest request, Long adminId, String adminEmail) {
        PasswordResetRequestEntity resetReq = passwordResetRequestRepository.findById(requestId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy yêu cầu cấp lại mật khẩu #" + requestId));

        User user = userRepositoryPort.findById(resetReq.getUserId())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng sở hữu yêu cầu này"));

        String rawPassword = request.getNewPassword().trim();
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepositoryPort.save(user);

        resetReq.setStatus("RESOLVED");
        resetReq.setResolvedAt(Instant.now());
        resetReq.setResolvedBy(adminId);
        resetReq.setNewPasswordTemp(rawPassword);
        PasswordResetRequestEntity saved = passwordResetRequestRepository.save(resetReq);

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    adminId,
                    AuditAction.USER_UPDATED,
                    "USER",
                    String.valueOf(user.getUserId()),
                    "Admin (" + adminEmail + ") đã cấp lại mật khẩu mới cho tài khoản: " + user.getEmail()
            );
        }

        log.info("[PasswordReset] Admin {} đã cấp lại mật khẩu thành công cho tài khoản {}", adminEmail, user.getEmail());
        return toResetResponse(saved);
    }

    @Override
    @Transactional
    public AdminUserResponse directResetPassword(Long userId, String newPassword, Long adminId, String adminEmail) {
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng #" + userId));

        user.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        User updated = userRepositoryPort.save(user);

        // Đánh dấu các yêu cầu PENDING của user này thành RESOLVED nếu có
        passwordResetRequestRepository.findFirstByEmailAndStatusOrderByCreatedAtDesc(user.getEmail(), "PENDING")
                .ifPresent(req -> {
                    req.setStatus("RESOLVED");
                    req.setResolvedAt(Instant.now());
                    req.setResolvedBy(adminId);
                    req.setNewPasswordTemp(newPassword.trim());
                    passwordResetRequestRepository.save(req);
                });

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    adminId,
                    AuditAction.USER_UPDATED,
                    "USER",
                    String.valueOf(user.getUserId()),
                    "Admin (" + adminEmail + ") trực tiếp đặt lại mật khẩu cho tài khoản: " + user.getEmail()
            );
        }

        return toResponse(updated);
    }

    private PasswordResetRequestResponse toResetResponse(PasswordResetRequestEntity e) {
        return PasswordResetRequestResponse.builder()
                .requestId(e.getRequestId())
                .userId(e.getUserId())
                .email(e.getEmail())
                .fullName(e.getFullName())
                .status(e.getStatus())
                .createdAt(e.getCreatedAt())
                .resolvedAt(e.getResolvedAt())
                .newPasswordTemp(e.getNewPasswordTemp())
                .build();
    }

    private AdminUserResponse toResponse(User user) {
        java.util.Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                : java.util.Collections.emptySet();

        return AdminUserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleStrings)
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null)
                .updatedAt(user.getUpdatedAt() != null ? user.getUpdatedAt().toString() : null)
                .build();
    }
}
