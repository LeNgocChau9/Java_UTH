package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
import com.example.livingdocs_backend.application.port.AuthServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Authentication & User", description = "Các API xác thực tài khoản JWT và thông tin người dùng")
public class AuthController {

    private final AuthServicePort authServicePort;

    @PostMapping("/auth/register")
    @Operation(summary = "Đăng ký tài khoản mới", description = "Tạo tài khoản mới với email và mật khẩu, kiểm tra trùng lặp email và cấp JWT token")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authServicePort.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/auth/login")
    @Operation(summary = "Đăng nhập hệ thống", description = "Xác thực email và mật khẩu bằng BCrypt, trả về JWT Access Token")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authServicePort.login(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Lấy thông tin tài khoản hiện tại", description = "Xác thực Bearer token từ Authorization header và trả về thông tin cá nhân")
    public ResponseEntity<UserProfileResponse> getCurrentUser(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        UserProfileResponse profile = authServicePort.getCurrentUserProfile(principal.getName());
        return ResponseEntity.ok(profile);
    }
}
