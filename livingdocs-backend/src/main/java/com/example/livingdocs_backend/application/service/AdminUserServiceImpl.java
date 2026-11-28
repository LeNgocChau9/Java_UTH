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
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PasswordResetRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.WorkspaceEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPasswordResetRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataWorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserServicePort {

    private final UserRepositoryPort userRepositoryPort;
    private final AuditServicePort auditServicePort;
    private final PasswordEncoder passwordEncoder;
    private final SpringDataPasswordResetRequestRepository passwordResetRequestRepository;

    @Autowired(required = false)
    private SpringDataWorkspaceRepository workspaceRepository;

    @Autowired(required = false)
    private SpringDataGitHubConnectionRepository gitHubConnectionRepository;

    @Override
    public List<AdminUserResponse> listUsers() {
        return listUsers(null, null, null);
    }

    @Override
    public List<AdminUserResponse> listUsers(String status, Long enterpriseId, Boolean unassigned) {
        Map<Long, String> githubMap = loadGitHubUsernameFallbackMap();
        // ponytail: in-memory filter over user list; switch to SQL Specification if user count exceeds a few thousand
        return userRepositoryPort.findAll().stream()
                .filter(u -> !StringUtils.hasText(status)
                        || status.trim().equalsIgnoreCase(u.getStatus()))
                .filter(u -> {
                    if (Boolean.TRUE.equals(unassigned)) {
                        return u.getWorkspaceId() == null;
                    }
                    if (enterpriseId != null) {
                        return enterpriseId.equals(u.getWorkspaceId());
                    }
                    return true;
                })
                .map(u -> toResponse(u, githubMap))
                .toList();
    }

    @Override
    @Transactional
    public AdminUserResponse createUser(AdminCreateUserRequest request, Long actorId, String actorEmail) {
        String email = request.getEmail().toLowerCase().trim();
        if (userRepositoryPort.existsByEmail(email)) {
            throw new EmailAlreadyExistsException("Email '" + email + "' đã tồn tại trong hệ thống");
        }

        Long enterpriseId = request.getEnterpriseId();
        WorkspaceEntity targetEnterprise = validateEnterpriseIfPresent(enterpriseId);

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
                .workspaceId(enterpriseId)
                .approvedBy(actorId)
                .approvedAt(Instant.now())
                .build();

        User savedUser = userRepositoryPort.save(newUser);
        userRepositoryPort.changeRole(savedUser.getUserId(), targetRole.getRawName());
        if (enterpriseId != null) {
            userRepositoryPort.assignEnterprise(savedUser.getUserId(), enterpriseId);
        }

        if (auditServicePort != null) {
            String enterpriseInfo = targetEnterprise != null
                    ? " tại doanh nghiệp '" + targetEnterprise.getName() + "'"
                    : " (chưa phân doanh nghiệp)";
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.USER_CREATED,
                    "USER",
                    String.valueOf(savedUser.getUserId()),
                    "Admin (" + actorEmail + ") tạo tài khoản mới: " + email
                            + " với vai trò " + targetRole.getRawName() + enterpriseInfo
            );
        }

        return toResponse(userRepositoryPort.findById(savedUser.getUserId()).orElse(savedUser), null);
    }

    @Override
    @Transactional
    public AdminUserResponse approveUser(Long userId, AdminApproveUserRequest request, Long actorId, String actorEmail) {
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng #" + userId));

        String currentStatus = user.getStatus() != null ? user.getStatus().trim().toUpperCase() : "ACTIVE";
        if (!"PENDING".equals(currentStatus) && !"REJECTED".equals(currentStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ có thể phê duyệt tài khoản đang ở trạng thái chờ duyệt (PENDING) hoặc đã từ chối (REJECTED)."
            );
        }

        Long targetEnterpriseId = request != null ? request.getEnterpriseId() : null;
        WorkspaceEntity targetEnterprise = validateEnterpriseIfPresent(targetEnterpriseId);

        RoleType targetRole = null;
        if (request != null && StringUtils.hasText(request.getRole())) {
            targetRole = RoleType.fromString(request.getRole());
        }

        user.setStatus("ACTIVE");
        user.setRejectionReason(null);
        user.setApprovedBy(actorId);
        user.setApprovedAt(Instant.now());
        userRepositoryPort.save(user);

        if (targetRole != null) {
            userRepositoryPort.changeRole(userId, targetRole.getRawName());
        }
        if (targetEnterpriseId != null) {
            userRepositoryPort.assignEnterprise(userId, targetEnterpriseId);
        }

        if (auditServicePort != null) {
            String detail = "Admin (" + actorEmail + ") phê duyệt tài khoản: " + user.getEmail();
            if (targetRole != null) {
                detail += " | vai trò: " + targetRole.getRawName();
            }
            if (targetEnterprise != null) {
                detail += " | doanh nghiệp: " + targetEnterprise.getName();
            }
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.USER_APPROVED,
                    "USER",
                    String.valueOf(userId),
                    detail
            );
        }

        return toResponse(userRepositoryPort.findById(userId).orElse(user), null);
    }

    @Override
    @Transactional
    public AdminUserResponse rejectUser(Long userId, AdminRejectUserRequest request, Long actorId, String actorEmail) {
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng #" + userId));

        String currentStatus = user.getStatus() != null ? user.getStatus().trim().toUpperCase() : "ACTIVE";
        if (!"PENDING".equals(currentStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ có thể từ chối tài khoản đang ở trạng thái chờ duyệt (PENDING)."
            );
        }

        String reason = request != null && StringUtils.hasText(request.getReason())
                ? request.getReason().trim()
                : null;

        user.setStatus("REJECTED");
        user.setRejectionReason(reason);
        user.setApprovedBy(actorId);
        user.setApprovedAt(Instant.now());
        userRepositoryPort.save(user);

        if (auditServicePort != null) {
            String detail = "Admin (" + actorEmail + ") từ chối tài khoản: " + user.getEmail()
                    + (reason != null ? " | Lý do: " + reason : "");
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.USER_REJECTED,
                    "USER",
                    String.valueOf(userId),
                    detail
            );
        }

        return toResponse(userRepositoryPort.findById(userId).orElse(user), null);
    }

    @Override
    @Transactional
    public AdminUserResponse assignUserEnterprise(Long userId, Long enterpriseId, Long actorId, String actorEmail) {
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng #" + userId));

        WorkspaceEntity targetEnterprise = validateEnterpriseIfPresent(enterpriseId);
        String oldEnterpriseName = user.getWorkspaceName() != null
                ? user.getWorkspaceName()
                : (user.getWorkspaceId() != null ? "#" + user.getWorkspaceId() : "Chưa phân doanh nghiệp");

        userRepositoryPort.assignEnterprise(userId, enterpriseId);

        if (auditServicePort != null) {
            String newEnterpriseName = targetEnterprise != null
                    ? targetEnterprise.getName()
                    : (enterpriseId != null ? "#" + enterpriseId : "Chưa phân doanh nghiệp");
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.USER_ENTERPRISE_CHANGED,
                    "USER",
                    String.valueOf(userId),
                    "Admin (" + actorEmail + ") đổi doanh nghiệp cho " + user.getEmail()
                            + ": " + oldEnterpriseName + " -> " + newEnterpriseName
            );
        }

        return toResponse(userRepositoryPort.findById(userId).orElse(user), null);
    }

    @Override
    @Transactional
    public AdminUserResponse changeRole(Long userId, String role, Long actorId, String actorEmail) {
        RoleType roleType = RoleType.fromString(role);
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng"));
        String previousRoles = user.getRoles() == null
                ? ""
                : user.getRoles().stream().map(Enum::name).sorted().collect(Collectors.joining(","));
        userRepositoryPort.changeRole(user.getUserId(), roleType.getRawName());
        if (auditServicePort != null) {
            auditServicePort.recordRoleChange(actorId, actorEmail, userId, previousRoles, roleType.getRawName());
        }
        return toResponse(userRepositoryPort.findById(userId).orElse(user), null);
    }

    @Override
    @Transactional
    public AdminUserResponse changeStatus(Long userId, boolean active, Long actorId, String actorEmail) {
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng"));
        String status = active ? "ACTIVE" : "LOCKED";
        User updated = userRepositoryPort.updateStatus(user.getUserId(), status);
        if (auditServicePort != null) {
            String verb = active ? "mở khóa" : "khóa";
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.USER_UPDATED,
                    "USER",
                    String.valueOf(userId),
                    "Admin (" + actorEmail + ") " + verb + " tài khoản: " + user.getEmail()
            );
        }
        return toResponse(updated, null);
    }

    @Override
    @Transactional
    public PasswordResetRequestResponse requestPasswordReset(ForgotPasswordRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        User user = userRepositoryPort.findByEmail(email)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy tài khoản với email: " + email));

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

        return toResponse(updated, null);
    }

    private WorkspaceEntity validateEnterpriseIfPresent(Long enterpriseId) {
        if (enterpriseId == null) {
            return null;
        }
        if (workspaceRepository == null) {
            return null;
        }
        return workspaceRepository.findById(enterpriseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy doanh nghiệp #" + enterpriseId));
    }

    private Map<Long, String> loadGitHubUsernameFallbackMap() {
        if (gitHubConnectionRepository == null) {
            return Collections.emptyMap();
        }
        try {
            Map<Long, String> map = new HashMap<>();
            for (GitHubConnectionEntity conn : gitHubConnectionRepository.findAll()) {
                if (conn.getUserId() != null && StringUtils.hasText(conn.getGithubUsername())) {
                    map.putIfAbsent(conn.getUserId(), conn.getGithubUsername());
                }
            }
            return map;
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
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

    public AdminUserResponse toResponse(User user) {
        return toResponse(user, null);
    }

    private AdminUserResponse toResponse(User user, Map<Long, String> githubFallbackMap) {
        Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(Collectors.toSet())
                : Collections.emptySet();

        String githubUsername = user.getGithubUsername();
        if (!StringUtils.hasText(githubUsername)) {
            if (githubFallbackMap != null) {
                githubUsername = githubFallbackMap.get(user.getUserId());
            } else if (gitHubConnectionRepository != null && user.getUserId() != null) {
                try {
                    githubUsername = gitHubConnectionRepository.findFirstByUserIdOrderByCreatedAtDesc(user.getUserId())
                            .map(GitHubConnectionEntity::getGithubUsername)
                            .orElse(null);
                } catch (Exception ignored) {
                }
            }
        }

        return AdminUserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleStrings)
                .enterpriseId(user.getWorkspaceId())
                .enterpriseName(user.getWorkspaceName())
                .githubUsername(githubUsername)
                .rejectionReason(user.getRejectionReason())
                .approvedAt(user.getApprovedAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
