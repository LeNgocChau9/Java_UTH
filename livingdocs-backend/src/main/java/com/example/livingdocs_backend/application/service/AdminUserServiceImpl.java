package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AdminUserResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.AdminUserServicePort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserServicePort {

    private final UserRepositoryPort userRepositoryPort;
    private final AuditServicePort auditServicePort;

    @Override
    public List<AdminUserResponse> listUsers() {
        return userRepositoryPort.findAll().stream()
                .map(this::toResponse)
                .toList();
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
