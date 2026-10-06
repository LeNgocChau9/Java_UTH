package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AuthResponse;
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

        String token = jwtTokenProvider.generateToken(user.getUserId(), user.getEmail());

        return AuthResponse.builder()
                .token(token)
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

    private UserProfileResponse toProfileResponse(User user) {
        return UserProfileResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
