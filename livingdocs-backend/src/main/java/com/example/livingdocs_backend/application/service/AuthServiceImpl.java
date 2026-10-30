package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.GitHubProfileRequest;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.AuthServicePort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.EmailAlreadyExistsException;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthServicePort {

    private final UserRepositoryPort userRepositoryPort;
    private final AuditServicePort auditServicePort;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository gitHubConnectionRepository;

    @Override
    public AuthResponse register(RegisterRequest request) {
        if (userRepositoryPort.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException("Email '" + request.getEmail() + "' đã được sử dụng");
        }

        User newUser = User.builder()
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .avatarUrl(request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank()
                        ? request.getAvatarUrl().trim()
                        : "https://api.dicebear.com/7.x/avataaars/svg?seed=" + request.getEmail().trim())
                .status("ACTIVE")
                .build();

        User savedUser = userRepositoryPort.save(newUser);
        // Đăng ký tài khoản mặc định vai trò ADMIN
        userRepositoryPort.changeRole(savedUser.getUserId(), "ADMIN");

        User freshUser = userRepositoryPort.findById(savedUser.getUserId()).orElse(savedUser);
        String token = jwtTokenProvider.generateToken(freshUser.getUserId(), freshUser.getEmail());

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .user(toProfileResponse(freshUser))
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        User user = userRepositoryPort.findByEmail(email)
                .orElse(null);

        if (user == null) {
            auditServicePort.recordLogin(null, email, false);
            throw new AuthenticationException("Email hoặc mật khẩu không chính xác");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            auditServicePort.recordLogin(user.getUserId(), email, false);
            throw new AuthenticationException("Email hoặc mật khẩu không chính xác");
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            auditServicePort.recordLogin(user.getUserId(), email, false);
            throw new AuthenticationException("Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt");
        }

        auditServicePort.recordLogin(user.getUserId(), email, true);

        java.util.Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                : java.util.Collections.singleton("ROLE_DEVELOPER");

        String token = jwtTokenProvider.generateToken(user.getUserId(), user.getEmail(), roleStrings);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .user(toProfileResponse(user))
                .build();
    }

    @Override
    public AuthResponse loginWithGithub(GitHubProfileRequest request) {
        String email = request.getEmail() != null ? request.getEmail().toLowerCase().trim() : null;

        // 1. Ưu tiên tìm người dùng đã liên kết với tài khoản GitHub này trong bảng github_connections
        User user = null;
        try {
            if (request.getGithubId() != null) {
                user = gitHubConnectionRepository.findFirstByGithubUserIdOrderByUpdatedAtDesc(request.getGithubId())
                        .flatMap(conn -> userRepositoryPort.findById(conn.getUserId()))
                        .orElse(null);
            }
            if (user == null && request.getLogin() != null && !request.getLogin().isBlank()) {
                user = gitHubConnectionRepository.findFirstByGithubUsernameIgnoreCaseOrderByUpdatedAtDesc(request.getLogin().trim())
                        .flatMap(conn -> userRepositoryPort.findById(conn.getUserId()))
                        .orElse(null);
            }
        } catch (Exception ignored) {
        }

        // 2. Nếu chưa liên kết với user nào thì mới tìm theo email của GitHub
        if (user == null) {
            if (email == null || email.isBlank()) {
                auditServicePort.recordLogin(null, email, false);
                throw new AuthenticationException("GitHub không cung cấp email để đăng nhập");
            }
            user = userRepositoryPort.findByEmail(email).orElse(null);
        }

        if (user == null) {
            // Người dùng mới: tạo tài khoản từ danh tính GitHub.
            // Mật khẩu là chuỗi ngẫu nhiên đã băm -> không thể đăng nhập bằng email/mật khẩu.
            User newUser = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                    .fullName(resolveFullName(request))
                    .avatarUrl(request.getAvatarUrl())
                    .status("ACTIVE")
                    .build();
            user = userRepositoryPort.save(newUser);
            // Gán vai trò mặc định (DEVELOPER) tại workspace mặc định để vai trò được ghi nhận trong CSDL.
            userRepositoryPort.assignDefaultWorkspaceRole(user.getUserId());
            user = userRepositoryPort.findById(user.getUserId()).orElse(user);
        } else {
            if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
                auditServicePort.recordLogin(user.getUserId(), user.getEmail(), false);
                throw new AuthenticationException("Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt");
            }
            // Làm mới ảnh đại diện nếu GitHub có và khác ảnh hiện tại.
            if (request.getAvatarUrl() != null && !request.getAvatarUrl().equals(user.getAvatarUrl())) {
                user.setAvatarUrl(request.getAvatarUrl());
                user = userRepositoryPort.save(user);
            }
        }

        auditServicePort.recordLogin(user.getUserId(), user.getEmail(), true);

        java.util.Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                : java.util.Collections.singleton("ROLE_DEVELOPER");

        String token = jwtTokenProvider.generateToken(user.getUserId(), user.getEmail(), roleStrings);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .user(toProfileResponse(user))
                .build();
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

        java.util.List<String> roles = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).toList()
                : java.util.List.of("ROLE_DEVELOPER");

        String newToken = jwtTokenProvider.generateToken(user.getUserId(), user.getEmail(), roles);

        return AuthResponse.builder()
                .token(newToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
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
    @org.springframework.transaction.annotation.Transactional
    public UserProfileResponse updateProfile(String email, com.example.livingdocs_backend.application.dto.UpdateProfileRequest request) {
        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));

        // 1. Cập nhật họ tên nếu có
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }

        // 2. Cập nhật avatar nếu có
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
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
        }

        User updatedUser = userRepositoryPort.save(user);
        return toProfileResponse(updatedUser);
    }

    private UserProfileResponse toProfileResponse(User user) {
        java.util.Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                : java.util.Collections.singleton("ROLE_DEVELOPER");

        String githubUsername = null;
        try {
            githubUsername = gitHubConnectionRepository.findFirstByUserIdOrderByCreatedAtDesc(user.getUserId())
                    .map(com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity::getGithubUsername)
                    .orElse(null);
        } catch (Exception ignored) {
        }

        return UserProfileResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleStrings)
                .githubUsername(githubUsername)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
