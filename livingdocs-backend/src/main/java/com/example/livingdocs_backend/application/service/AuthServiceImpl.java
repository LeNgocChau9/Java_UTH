package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.GitHubProfileRequest;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
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
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public AuthResponse register(RegisterRequest request) {
        if (userRepositoryPort.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException("Email '" + request.getEmail() + "' đã được sử dụng");
        }

        User newUser = User.builder()
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .avatarUrl(request.getAvatarUrl())
                .status("ACTIVE")
                .build();

        User savedUser = userRepositoryPort.save(newUser);
        String token = jwtTokenProvider.generateToken(savedUser.getUserId(), savedUser.getEmail());

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationSeconds())
                .user(toProfileResponse(savedUser))
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        User user = userRepositoryPort.findByEmail(email)
                .orElseThrow(() -> new AuthenticationException("Email hoặc mật khẩu không chính xác"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AuthenticationException("Email hoặc mật khẩu không chính xác");
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new AuthenticationException("Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt");
        }

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
        if (email == null || email.isBlank()) {
            throw new AuthenticationException("GitHub không cung cấp email để đăng nhập");
        }

        User user = userRepositoryPort.findByEmail(email).orElse(null);

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
                throw new AuthenticationException("Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt");
            }
            // Làm mới ảnh đại diện nếu GitHub có và khác ảnh hiện tại.
            if (request.getAvatarUrl() != null && !request.getAvatarUrl().equals(user.getAvatarUrl())) {
                user.setAvatarUrl(request.getAvatarUrl());
                user = userRepositoryPort.save(user);
            }
        }

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
    public UserProfileResponse getCurrentUserProfile(String email) {
        User user = userRepositoryPort.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy thông tin người dùng"));

        return toProfileResponse(user);
    }

    private UserProfileResponse toProfileResponse(User user) {
        java.util.Set<String> roleStrings = user.getRoles() != null
                ? user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                : java.util.Collections.singleton("ROLE_DEVELOPER");

        return UserProfileResponse.builder()
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
