package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.GitHubProfileRequest;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UpdateProfileRequest;
import com.example.livingdocs_backend.application.dto.UserNotificationPreferencesDto;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.AuthServicePort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.EmailAlreadyExistsException;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.UserNotificationPreferenceEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserNotificationPreferenceRepository;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthServicePort {

    public static final String MSG_REGISTER_PENDING =
            "Đăng ký tài khoản thành công! Tài khoản đang chờ Quản trị viên phê duyệt trước khi đăng nhập.";
    public static final String MSG_GITHUB_REGISTER_PENDING =
            "Tài khoản GitHub của bạn đã được tạo và đang chờ Quản trị viên phê duyệt trước khi đăng nhập.";
    public static final String MSG_ACCOUNT_PENDING =
            "Tài khoản của bạn đang chờ Quản trị viên phê duyệt. Vui lòng thử lại sau khi được duyệt.";
    public static final String MSG_ACCOUNT_REJECTED =
            "Yêu cầu đăng ký tài khoản của bạn đã bị Quản trị viên từ chối.";
    public static final String MSG_ACCOUNT_LOCKED =
            "Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ quản trị hệ thống.";

    private final UserRepositoryPort userRepositoryPort;
    private final AuditServicePort auditServicePort;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;

    @Autowired(required = false)
    private SpringDataUserNotificationPreferenceRepository notificationPreferenceRepository;

    public void setNotificationPreferenceRepository(SpringDataUserNotificationPreferenceRepository notificationPreferenceRepository) {
        this.notificationPreferenceRepository = notificationPreferenceRepository;
    }

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().toLowerCase().trim();
        if (userRepositoryPort.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyExistsException("Email '" + request.getEmail() + "' đã được sử dụng");
        }

        User newUser = User.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .avatarUrl(request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank()
                        ? request.getAvatarUrl().trim()
                        : "https://api.dicebear.com/7.x/avataaars/svg?seed=" + normalizedEmail)
                .status("PENDING")
                .workspaceId(null)
                .build();

        User savedUser = userRepositoryPort.save(newUser);
        // Tự đăng ký mặc định vai trò DEVELOPER (chưa phân vào doanh nghiệp nào, chờ Admin phê duyệt)
        userRepositoryPort.changeRole(savedUser.getUserId(), "DEVELOPER");

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    savedUser.getUserId(),
                    AuditAction.USER_REGISTERED,
                    "USER",
                    String.valueOf(savedUser.getUserId()),
                    "Đăng ký tài khoản mới (chờ phê duyệt): " + normalizedEmail
            );
        }

        User freshUser = userRepositoryPort.findById(savedUser.getUserId()).orElse(savedUser);
        return AuthResponse.builder()
                .token(null)
                .tokenType(null)
                .expiresIn(null)
                .pendingApproval(true)
                .message(MSG_REGISTER_PENDING)
                .user(toProfileResponse(freshUser))
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        User user = userRepositoryPort.findByEmail(email)
                .orElse(null);

        if (user == null) {
            if (auditServicePort != null) {
                auditServicePort.recordLogin(null, email, false);
            }
            throw new AuthenticationException("Email hoặc mật khẩu không chính xác");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            if (auditServicePort != null) {
                auditServicePort.recordLogin(user.getUserId(), email, false);
            }
            throw new AuthenticationException("Email hoặc mật khẩu không chính xác");
        }

        ensureAccountActive(user, true);

        if (auditServicePort != null) {
            auditServicePort.recordLogin(user.getUserId(), email, true);
        }

        Set<String> roleStrings = extractRoleStrings(user);
        String token = jwtTokenProvider.generateToken(
                user.getUserId(), user.getEmail(), roleStrings, user.getWorkspaceId());

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .pendingApproval(false)
                .user(toProfileResponse(user))
                .build();
    }

    @Override
    @Transactional
    public AuthResponse loginWithGithub(GitHubProfileRequest request) {
        String email = request.getEmail() != null ? request.getEmail().toLowerCase().trim() : null;
        String login = request.getLogin() != null ? request.getLogin().trim() : null;

        // 1. Tìm người dùng đã gắn github_user_id / github_username trực tiếp trên bảng users
        User user = null;
        if (request.getGithubId() != null) {
            user = userRepositoryPort.findByGithubUserId(request.getGithubId()).orElse(null);
        }
        if (user == null && login != null && !login.isBlank()) {
            user = userRepositoryPort.findByGithubUsername(login).orElse(null);
        }

        // 2. Fallback: tìm qua bảng github_connections (tương thích tài khoản cũ)
        if (user == null && gitHubConnectionRepository != null) {
            try {
                if (request.getGithubId() != null) {
                    user = gitHubConnectionRepository.findFirstByGithubUserIdOrderByUpdatedAtDesc(request.getGithubId())
                            .flatMap(conn -> userRepositoryPort.findById(conn.getUserId()))
                            .orElse(null);
                }
                if (user == null && login != null && !login.isBlank()) {
                    user = gitHubConnectionRepository.findFirstByGithubUsernameIgnoreCaseOrderByUpdatedAtDesc(login)
                            .flatMap(conn -> userRepositoryPort.findById(conn.getUserId()))
                            .orElse(null);
                }
            } catch (Exception ignored) {
            }
        }

        // 3. Nếu chưa liên kết với user nào thì tìm theo email của GitHub
        if (user == null) {
            if (email == null || email.isBlank()) {
                if (auditServicePort != null) {
                    auditServicePort.recordLogin(null, email, false);
                }
                throw new AuthenticationException("GitHub không cung cấp email để đăng nhập");
            }
            user = userRepositoryPort.findByEmail(email).orElse(null);
        }

        if (user == null) {
            // Người dùng GitHub lần đầu: tạo tài khoản trạng thái PENDING, vai trò DEVELOPER, chưa phân doanh nghiệp.
            User newUser = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .fullName(resolveFullName(request))
                    .avatarUrl(request.getAvatarUrl())
                    .status("PENDING")
                    .workspaceId(null)
                    .githubUserId(request.getGithubId())
                    .githubUsername(login)
                    .build();
            user = userRepositoryPort.save(newUser);
            userRepositoryPort.changeRole(user.getUserId(), "DEVELOPER");
            user = userRepositoryPort.findById(user.getUserId()).orElse(user);

            if (auditServicePort != null) {
                auditServicePort.recordSecurityAction(
                        user.getUserId(),
                        AuditAction.USER_REGISTERED,
                        "USER",
                        String.valueOf(user.getUserId()),
                        "Đăng ký lần đầu qua GitHub @" + (login != null ? login : email) + " (chờ phê duyệt)"
                );
            }

            return AuthResponse.builder()
                    .token(null)
                    .tokenType(null)
                    .expiresIn(null)
                    .pendingApproval(true)
                    .message(MSG_GITHUB_REGISTER_PENDING)
                    .user(toProfileResponse(user))
                    .build();
        }

        ensureAccountActive(user, true);

        boolean needsSave = false;
        if (request.getGithubId() != null && !request.getGithubId().equals(user.getGithubUserId())) {
            user.setGithubUserId(request.getGithubId());
            needsSave = true;
        }
        if (login != null && !login.isBlank() && !login.equals(user.getGithubUsername())) {
            user.setGithubUsername(login);
            needsSave = true;
        }
        if (request.getAvatarUrl() != null && !request.getAvatarUrl().equals(user.getAvatarUrl())) {
            user.setAvatarUrl(request.getAvatarUrl());
            needsSave = true;
        }
        if (needsSave) {
            user = userRepositoryPort.save(user);
        }

        if (auditServicePort != null) {
            auditServicePort.recordLogin(user.getUserId(), user.getEmail(), true);
        }

        Set<String> roleStrings = extractRoleStrings(user);
        String token = jwtTokenProvider.generateToken(
                user.getUserId(), user.getEmail(), roleStrings, user.getWorkspaceId());

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .pendingApproval(false)
                .user(toProfileResponse(user))
                .build();
    }

    private void ensureAccountActive(User user, boolean recordLoginFailure) {
        String status = user.getStatus() != null ? user.getStatus().trim().toUpperCase() : "ACTIVE";
        if ("ACTIVE".equals(status)) {
            return;
        }
        if (recordLoginFailure && auditServicePort != null) {
            auditServicePort.recordLogin(user.getUserId(), user.getEmail(), false);
        }
        switch (status) {
            case "PENDING" -> throw AuthenticationException.forbidden("ACCOUNT_PENDING", MSG_ACCOUNT_PENDING);
            case "REJECTED" -> {
                String msg = user.getRejectionReason() != null && !user.getRejectionReason().isBlank()
                        ? MSG_ACCOUNT_REJECTED + " Lý do: " + user.getRejectionReason().trim()
                        : MSG_ACCOUNT_REJECTED;
                throw AuthenticationException.forbidden("ACCOUNT_REJECTED", msg);
            }
            default -> throw AuthenticationException.forbidden("ACCOUNT_LOCKED", MSG_ACCOUNT_LOCKED);
        }
    }

    private Set<String> extractRoleStrings(User user) {
        return user.getRoles() != null && !user.getRoles().isEmpty()
                ? user.getRoles().stream().map(Enum::name).collect(Collectors.toSet())
                : Collections.singleton("ROLE_DEVELOPER");
    }

    private String resolveFullName(GitHubProfileRequest request) {
        if (request.getName() != null && !request.getName().isBlank()) {
            return request.getName().trim();
        }
        if (request.getLogin() != null && !request.getLogin().isBlank()) {
            return request.getLogin().trim();
        }
        return request.getEmail();
    }

    @Override
    public AuthResponse refreshToken(String token) {
        if (token == null || token.isBlank()) {
            throw new AuthenticationException("Token không hợp lệ để gia hạn phiên");
        }
        String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
        String email;
        try {
            email = jwtTokenProvider.getEmailFromToken(cleanToken);
        } catch (Exception ex) {
            throw new AuthenticationException("Phiên đăng nhập đã quá hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
        }

        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));

        ensureAccountActive(user, false);

        List<String> roles = user.getRoles() != null && !user.getRoles().isEmpty()
                ? user.getRoles().stream().map(Enum::name).toList()
                : List.of("ROLE_DEVELOPER");

        String newToken = jwtTokenProvider.generateToken(
                user.getUserId(), user.getEmail(), roles, user.getWorkspaceId());

        return AuthResponse.builder()
                .token(newToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .pendingApproval(false)
                .user(toProfileResponse(user))
                .build();
    }

    @Override
    public UserProfileResponse getCurrentUserProfile(String email) {
        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));

        return toProfileResponse(user);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));

        List<String> changedFields = new ArrayList<>();

        // 1. Cập nhật họ tên nếu có
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
            changedFields.add("fullName");
        }

        // 2. Cập nhật avatar nếu có
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
            changedFields.add("avatarUrl");
        }

        // 3. Đổi mật khẩu nếu có yêu cầu
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            // Kiểm tra mật khẩu cũ nếu tài khoản có mật khẩu
            if (user.getPasswordHash() != null && !user.getPasswordHash().isBlank()) {
                if (request.getOldPassword() == null || !passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
                    throw new AuthenticationException("Mật khẩu hiện tại không chính xác");
                }
            }
            user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
            changedFields.add("password");
        }

        User updatedUser = userRepositoryPort.save(user);

        // 4. Cập nhật tùy chọn nhận thông báo nếu có gửi kèm trong request
        if (request.getNotificationPreferences() != null) {
            saveNotificationPreferencesForUser(updatedUser.getUserId(), request.getNotificationPreferences());
            changedFields.add("notificationPreferences");
        }

        if (!changedFields.isEmpty() && auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    updatedUser.getUserId(),
                    AuditAction.USER_UPDATED,
                    "USER",
                    String.valueOf(updatedUser.getUserId()),
                    "Cập nhật hồ sơ cá nhân: " + String.join(", ", changedFields)
            );
        }

        return toProfileResponse(updatedUser);
    }

    @Override
    public UserNotificationPreferencesDto getNotificationPreferences(String email) {
        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));
        return loadOrDefaultNotificationPreferences(user.getUserId());
    }

    @Override
    @Transactional
    public UserNotificationPreferencesDto updateNotificationPreferences(String email, UserNotificationPreferencesDto request) {
        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));

        UserNotificationPreferencesDto saved = saveNotificationPreferencesForUser(user.getUserId(), request);

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    user.getUserId(),
                    AuditAction.USER_UPDATED,
                    "USER_NOTIFICATION_PREFERENCES",
                    String.valueOf(user.getUserId()),
                    String.format(
                            "Cập nhật tùy chọn thông báo: review=%s, driftAlert=%s, githubTokenIssue=%s, email=%s",
                            saved.getReviewEnabled(),
                            saved.getDriftAlertEnabled(),
                            saved.getGithubTokenIssueEnabled(),
                            saved.getEmailEnabled()
                    )
            );
        }
        return saved;
    }

    private UserNotificationPreferencesDto loadOrDefaultNotificationPreferences(Long userId) {
        if (userId == null) {
            return defaultNotificationPreferences(null);
        }
        if (notificationPreferenceRepository != null) {
            try {
                Optional<UserNotificationPreferenceEntity> opt = notificationPreferenceRepository.findById(userId);
                if (opt.isPresent()) {
                    return toNotificationPreferencesDto(opt.get());
                }
            } catch (Exception ignored) {
            }
        }
        return defaultNotificationPreferences(userId);
    }

    private UserNotificationPreferencesDto saveNotificationPreferencesForUser(Long userId, UserNotificationPreferencesDto request) {
        if (userId == null) {
            throw new AuthenticationException("Không xác định được người dùng để lưu tùy chọn thông báo");
        }
        UserNotificationPreferenceEntity entity = null;
        if (notificationPreferenceRepository != null) {
            try {
                entity = notificationPreferenceRepository.findById(userId).orElse(null);
            } catch (Exception ignored) {
            }
        }
        if (entity == null) {
            entity = UserNotificationPreferenceEntity.builder()
                    .userId(userId)
                    .emailEnabled(true)
                    .reviewEnabled(true)
                    .documentEnabled(true)
                    .githubEnabled(true)
                    .updatedAt(Instant.now())
                    .build();
        }

        if (request != null) {
            if (request.getEmailEnabled() != null) {
                entity.setEmailEnabled(request.getEmailEnabled());
            }
            if (request.getReviewEnabled() != null) {
                entity.setReviewEnabled(request.getReviewEnabled());
            }
            // Ưu tiên driftAlertEnabled, nếu null thì đọc documentEnabled
            Boolean driftOrDoc = request.getDriftAlertEnabled() != null
                    ? request.getDriftAlertEnabled()
                    : request.getDocumentEnabled();
            if (driftOrDoc != null) {
                entity.setDocumentEnabled(driftOrDoc);
            }
            // Ưu tiên githubTokenIssueEnabled, nếu null thì đọc githubEnabled
            Boolean githubTokenOrGithub = request.getGithubTokenIssueEnabled() != null
                    ? request.getGithubTokenIssueEnabled()
                    : request.getGithubEnabled();
            if (githubTokenOrGithub != null) {
                entity.setGithubEnabled(githubTokenOrGithub);
            }
        }

        entity.setUpdatedAt(Instant.now());
        if (notificationPreferenceRepository != null) {
            entity = notificationPreferenceRepository.save(entity);
        }
        return toNotificationPreferencesDto(entity);
    }

    private UserNotificationPreferencesDto toNotificationPreferencesDto(UserNotificationPreferenceEntity entity) {
        boolean emailEnabled = entity.isEmailEnabled();
        boolean reviewEnabled = entity.isReviewEnabled();
        boolean documentEnabled = entity.isDocumentEnabled();
        boolean githubEnabled = entity.isGithubEnabled();

        return UserNotificationPreferencesDto.builder()
                .userId(entity.getUserId())
                .emailEnabled(emailEnabled)
                .reviewEnabled(reviewEnabled)
                .driftAlertEnabled(documentEnabled)
                .documentEnabled(documentEnabled)
                .githubTokenIssueEnabled(githubEnabled)
                .githubEnabled(githubEnabled)
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private UserNotificationPreferencesDto defaultNotificationPreferences(Long userId) {
        return UserNotificationPreferencesDto.builder()
                .userId(userId)
                .emailEnabled(true)
                .reviewEnabled(true)
                .driftAlertEnabled(true)
                .documentEnabled(true)
                .githubTokenIssueEnabled(true)
                .githubEnabled(true)
                .build();
    }

    private UserProfileResponse toProfileResponse(User user) {
        Set<String> roleStrings = extractRoleStrings(user);

        String githubUsername = user.getGithubUsername();
        if ((githubUsername == null || githubUsername.isBlank()) && gitHubConnectionRepository != null) {
            try {
                githubUsername = gitHubConnectionRepository.findFirstByUserIdOrderByCreatedAtDesc(user.getUserId())
                        .map(GitHubConnectionEntity::getGithubUsername)
                        .orElse(null);
            } catch (Exception ignored) {
            }
        }

        return UserProfileResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleStrings)
                .enterpriseId(user.getWorkspaceId())
                .enterpriseName(user.getWorkspaceName())
                .workspaceId(user.getWorkspaceId())
                .githubUsername(githubUsername)
                .createdAt(user.getCreatedAt())
                .notificationPreferences(loadOrDefaultNotificationPreferences(user.getUserId()))
                .build();
    }
}
