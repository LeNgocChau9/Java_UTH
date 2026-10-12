package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.GitHubProfileRequest;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
import com.example.livingdocs_backend.application.port.AuthServicePort;
import com.example.livingdocs_backend.infrastructure.config.GitHubOAuthProperties;
import com.example.livingdocs_backend.infrastructure.github.GitHubOAuthClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Authentication & User", description = "Các API xác thực tài khoản JWT và thông tin người dùng")
public class AuthController {

    private final AuthServicePort authServicePort;
    private final GitHubOAuthClient gitHubOAuthClient;
    private final GitHubOAuthProperties gitHubOAuthProperties;

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

    // ═══ Đăng nhập bằng GitHub OAuth2 (Authorization Code Flow) ═══

    @GetMapping("/auth/github")
    @Operation(summary = "Bắt đầu đăng nhập bằng GitHub", description = "Sinh state chống CSRF rồi chuyển hướng trình duyệt sang trang cho phép của GitHub.")
    public void githubAuthorize(@RequestParam(value = "redirect", required = false) String redirect,
                                HttpServletResponse response) throws IOException {
        if (!gitHubOAuthClient.isConfigured()) {
            response.sendRedirect(gitHubOAuthProperties.getLoginUrl() + "?error=oauth_not_configured");
            return;
        }

        String state = UUID.randomUUID().toString();
        addCookie(response, "ld_oauth_state", state, 600);
        addCookie(response, "ld_oauth_redirect", sanitizeRedirect(redirect), 600);

        response.sendRedirect(gitHubOAuthClient.buildAuthorizeUrl(state));
    }

    @GetMapping("/auth/github/callback")
    @Operation(summary = "GitHub OAuth callback", description = "Nhận code từ GitHub, trao đổi token, tạo/cập nhật người dùng rồi chuyển hướng về frontend kèm JWT.")
    public void githubCallback(@RequestParam(value = "code", required = false) String code,
                               @RequestParam(value = "state", required = false) String state,
                               @RequestParam(value = "error", required = false) String error,
                               HttpServletRequest request,
                               HttpServletResponse response) throws IOException {
        String loginUrl = gitHubOAuthProperties.getLoginUrl();

        if (error != null) {
            clearOAuthCookies(response);
            response.sendRedirect(loginUrl + "?error=" + urlEncode(error));
            return;
        }
        if (code == null || state == null) {
            clearOAuthCookies(response);
            response.sendRedirect(loginUrl + "?error=oauth_failed");
            return;
        }

        String cookieState = readCookie(request, "ld_oauth_state");
        String redirectTarget = readCookie(request, "ld_oauth_redirect");
        clearOAuthCookies(response);

        if (cookieState == null || !cookieState.equals(state)) {
            response.sendRedirect(loginUrl + "?error=oauth_state");
            return;
        }

        try {
            GitHubOAuthClient.GitHubIdentity identity = gitHubOAuthClient.fetchIdentity(code);
            GitHubProfileRequest profile = new GitHubProfileRequest(
                    identity.id(), identity.login(), identity.name(), identity.email(), identity.avatarUrl());
            AuthResponse auth = authServicePort.loginWithGithub(profile);

            String target = sanitizeRedirect(redirectTarget);
            String callbackUrl = gitHubOAuthProperties.getFrontendCallbackUrl()
                    + "?token=" + urlEncode(auth.getToken())
                    + "&redirect=" + urlEncode(target);
            response.sendRedirect(callbackUrl);
        } catch (Exception ex) {
            response.sendRedirect(loginUrl + "?error=oauth_failed");
        }
    }

    private static void addCookie(HttpServletResponse response, String name, String value, int maxAgeSeconds) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAgeSeconds);
        response.addCookie(cookie);
    }

    private static void clearOAuthCookies(HttpServletResponse response) {
        addCookie(response, "ld_oauth_state", "", 0);
        addCookie(response, "ld_oauth_redirect", "", 0);
    }

    private static String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    /** Chỉ cho phép điều hướng nội bộ (tránh open-redirect). Mặc định về /dashboard. */
    private static String sanitizeRedirect(String redirect) {
        if (redirect == null || redirect.isBlank()) {
            return "/dashboard";
        }
        String trimmed = redirect.trim();
        if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
            return "/dashboard";
        }
        return trimmed;
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
