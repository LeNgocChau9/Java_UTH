package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AdminCreateUserRequest;
import com.example.livingdocs_backend.application.dto.AdminUserResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.AdminUserServicePort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.EmailAlreadyExistsException;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserServicePort {

    private final UserRepositoryPort userRepositoryPort;
    private final AuditServicePort auditServicePort;
    private final PasswordEncoder passwordEncoder;

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

    private AdminUserResponse toResponse(User user) {
        java.util.Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                : java.util.Collections.singleton("ROLE_DEVELOPER");

        return AdminUserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleStrings)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
