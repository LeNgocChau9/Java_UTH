package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.GitHubProfileRequest;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
import com.example.livingdocs_backend.application.port.AuthServicePort;
import com.example.livingdocs_backend.infrastructure.config.GitHubOAuthProperties;
import com.example.livingdocs_backend.infrastructure.github.GitHubOAuthClient;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
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
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Authentication & User", description = "Các API xác thực tài khoản JWT và thông tin người dùng")
public class AuthController {

    private final AuthServicePort authServicePort;
    private final GitHubOAuthClient gitHubOAuthClient;
    private final GitHubOAuthProperties gitHubOAuthProperties;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final com.example.livingdocs_backend.domain.repository.UserRepositoryPort userRepositoryPort;
    private final com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider jwtTokenProvider;

    // Lưu tạm state -> userId/redirect trong bộ nhớ để đảm bảo không bị mất cookie khi đi qua Next.js proxy
    private final Map<String, Long> pendingLinkUsers = new ConcurrentHashMap<>();
    private final Map<String, String> pendingRedirects = new ConcurrentHashMap<>();

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

    @PostMapping("/auth/refresh")
    @Operation(summary = "Gia hạn phiên đăng nhập", description = "Làm mới và cấp JWT Access Token mới khi phiên gần hết hạn hoặc cần kéo dài")
    public ResponseEntity<AuthResponse> refresh(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        AuthResponse response = authServicePort.refreshToken(authHeader);
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

    @PutMapping("/me")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(summary = "Cập nhật thông tin cá nhân", description = "Cho phép người dùng tự đổi tên, đổi avatar và đổi mật khẩu tài khoản của chính mình")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @Valid @RequestBody com.example.livingdocs_backend.application.dto.UpdateProfileRequest request,
            Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        UserProfileResponse updated = authServicePort.updateProfile(principal.getName(), request);
        return ResponseEntity.ok(updated);
    }

    // ═══ Đăng nhập hoặc Liên kết bằng GitHub OAuth2 (Authorization Code Flow) ═══

    @GetMapping("/auth/github")
    @Operation(summary = "Bắt đầu đăng nhập hoặc liên kết bằng GitHub", description = "Sinh state chống CSRF rồi chuyển hướng trình duyệt sang trang cho phép của GitHub.")
    public void githubAuthorize(@RequestParam(value = "redirect", required = false) String redirect,
                                @RequestParam(value = "token", required = false) String token,
                                @RequestParam(value = "mode", required = false) String mode,
                                HttpServletRequest request,
                                HttpServletResponse response) throws IOException {
        if (!gitHubOAuthClient.isConfigured()) {
            response.sendRedirect(gitHubOAuthProperties.getLoginUrl() + "?error=oauth_not_configured");
            return;
        }

        String state = UUID.randomUUID().toString();
        String cleanRedirect = sanitizeRedirect(redirect);
        pendingRedirects.put(state, cleanRedirect);
        addCookie(response, "ld_oauth_state", state, 600);
        addCookie(response, "ld_oauth_redirect", cleanRedirect, 600);

        // Lấy token từ query param hoặc từ cookie livingdocs_access_token nếu đang ở chế độ liên kết (mode=link)
        String resolvedToken = token;
        if ((resolvedToken == null || resolvedToken.isBlank()) && "link".equalsIgnoreCase(mode)) {
            resolvedToken = readCookie(request, "livingdocs_access_token");
        }

        if (resolvedToken != null && !resolvedToken.isBlank()) {
            Long linkUserId = null;
            try {
                linkUserId = jwtTokenProvider.getUserIdFromToken(resolvedToken);
            } catch (Exception ignored) {
            }
            if (linkUserId != null) {
                pendingLinkUsers.put(state, linkUserId);
                addCookie(response, "ld_oauth_link_user_id", String.valueOf(linkUserId), 600);
            } else {
                addCookie(response, "ld_oauth_link_user_id", "", 0);
            }
        } else {
            addCookie(response, "ld_oauth_link_user_id", "", 0);
        }

        response.sendRedirect(gitHubOAuthClient.buildAuthorizeUrl(state));
    }

    @GetMapping("/auth/github/callback")
    @Operation(summary = "GitHub OAuth callback", description = "Nhận code từ GitHub, trao đổi token, tạo/cập nhật người dùng hoặc liên kết rồi chuyển hướng về frontend kèm JWT.")
    public void githubCallback(@RequestParam(value = "code", required = false) String code,
                               @RequestParam(value = "state", required = false) String state,
                               @RequestParam(value = "error", required = false) String error,
                               HttpServletRequest request,
                               HttpServletResponse response) throws IOException {
        String loginUrl = gitHubOAuthProperties.getLoginUrl();

        if (error != null) {
            if (state != null) {
                pendingRedirects.remove(state);
                pendingLinkUsers.remove(state);
            }
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
        String memoryRedirect = pendingRedirects.remove(state);
        Long memoryLinkUserId = pendingLinkUsers.remove(state);
        String redirectTarget = memoryRedirect != null ? memoryRedirect : readCookie(request, "ld_oauth_redirect");
        String linkUserIdStr = readCookie(request, "ld_oauth_link_user_id");
        clearOAuthCookies(response);

        boolean stateValid = (cookieState != null && cookieState.equals(state)) || memoryRedirect != null;
        if (!stateValid) {
            response.sendRedirect(loginUrl + "?error=oauth_state");
            return;
        }

        Long resolvedLinkUserId = memoryLinkUserId;
        if (resolvedLinkUserId == null && linkUserIdStr != null && !linkUserIdStr.isBlank()) {
            try {
                resolvedLinkUserId = Long.parseLong(linkUserIdStr);
            } catch (NumberFormatException ignored) {
            }
        }

        try {
            GitHubOAuthClient.GitHubIdentity identity = gitHubOAuthClient.fetchIdentity(code);

            // Kiểm tra xem đây có phải luồng liên kết tài khoản cho người dùng đang đăng nhập không
            if (resolvedLinkUserId != null) {
                final Long linkUserId = resolvedLinkUserId;
                java.util.Optional<com.example.livingdocs_backend.domain.model.User> userOpt = userRepositoryPort.findById(linkUserId);
                if (userOpt.isPresent()) {
                    com.example.livingdocs_backend.domain.model.User currentUser = userOpt.get();

                    // 1. Lưu hoặc cập nhật kết nối GitHub cho chính tài khoản đang đăng nhập (linkUserId)
                    Long workspaceId = 1L; // Workspace mặc định
                    GitHubConnectionEntity conn =
                            gitHubConnectionRepository.findByWorkspaceIdAndUserId(workspaceId, linkUserId)
                                    .orElse(GitHubConnectionEntity.builder()
                                            .workspaceId(workspaceId)
                                            .userId(linkUserId)
                                            .build());

                    conn.setGithubUserId(identity.id());
                    conn.setGithubUsername(identity.login());
                    conn.setAccessTokenEncrypted(identity.accessToken() != null ? identity.accessToken() : "placeholder");
                    conn.setStatus("CONNECTED");
                    conn.setUpdatedAt(Instant.now());
                    conn = gitHubConnectionRepository.save(conn);

                    // 2. Chuyển quyền sở hữu repo và gỡ liên kết GitHub trùng lặp khỏi tài khoản cũ (nếu có)
                    reassignAndRemoveDuplicateConnections(linkUserId, conn, identity);

                    // 3. Tự động kéo danh sách Repositories từ tài khoản GitHub vừa liên kết về Workspace
                    autoSyncGitHubRepositories(workspaceId, conn);

                    // 4. Cập nhật avatar nếu người dùng chưa có
                    if (currentUser.getAvatarUrl() == null || currentUser.getAvatarUrl().isBlank()) {
                        currentUser.setAvatarUrl(identity.avatarUrl());
                        userRepositoryPort.save(currentUser);
                    }

                    // 5. Cấp lại token JWT cho chính user hiện tại để bảo toàn quyền hạn (DEVELOPER, ADMIN, ...)
                    java.util.Set<String> roleStrings = currentUser.getRoles() != null
                            ? currentUser.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet())
                            : java.util.Collections.singleton("ROLE_DEVELOPER");

                    String newToken = jwtTokenProvider.generateToken(currentUser.getUserId(), currentUser.getEmail(), roleStrings);

                    String target = sanitizeRedirect(redirectTarget);
                    String callbackUrl = gitHubOAuthProperties.getFrontendCallbackUrl()
                            + "?token=" + urlEncode(newToken)
                            + "&redirect=" + urlEncode(target);
                    response.sendRedirect(callbackUrl);
                    return;
                }
            }

            // Luồng thông thường: Đăng nhập bằng GitHub khi chưa có phiên đăng nhập
            GitHubProfileRequest profile = new GitHubProfileRequest(
                    identity.id(), identity.login(), identity.name(), identity.email(), identity.avatarUrl());
            AuthResponse auth = authServicePort.loginWithGithub(profile);

            // Tự động lưu/cập nhật bảng github_connections và đồng bộ danh sách repo cho user này
            try {
                Long userId = auth.getUser().getUserId();
                Long workspaceId = 1L; // Workspace mặc định
                GitHubConnectionEntity conn =
                        gitHubConnectionRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                                .orElse(GitHubConnectionEntity.builder()
                                        .workspaceId(workspaceId)
                                        .userId(userId)
                                        .build());

                conn.setGithubUserId(identity.id());
                conn.setGithubUsername(identity.login());
                conn.setAccessTokenEncrypted(identity.accessToken() != null ? identity.accessToken() : "placeholder");
                conn.setStatus("CONNECTED");
                conn.setUpdatedAt(Instant.now());
                conn = gitHubConnectionRepository.save(conn);

                autoSyncGitHubRepositories(workspaceId, conn);
            } catch (Exception connEx) {
                // Không để lỗi connection chặn đăng nhập
            }

            String target = sanitizeRedirect(redirectTarget);
            String callbackUrl = gitHubOAuthProperties.getFrontendCallbackUrl()
                    + "?token=" + urlEncode(auth.getToken())
                    + "&redirect=" + urlEncode(target);
            response.sendRedirect(callbackUrl);
        } catch (Exception ex) {
            response.sendRedirect(loginUrl + "?error=oauth_failed");
        }
    }

    private void reassignAndRemoveDuplicateConnections(Long linkUserId,
                                                       GitHubConnectionEntity activeConn,
                                                       GitHubOAuthClient.GitHubIdentity identity) {
        try {
            if (identity.id() != null) {
                for (var oldConn : gitHubConnectionRepository.findByGithubUserId(identity.id())) {
                    if (!linkUserId.equals(oldConn.getUserId())) {
                        for (RepositoryEntity repo : repositoryRepository.findByConnectionId(oldConn.getConnectionId())) {
                            repo.setConnectionId(activeConn.getConnectionId());
                            repositoryRepository.save(repo);
                        }
                        gitHubConnectionRepository.delete(oldConn);
                    }
                }
            }
            if (identity.login() != null) {
                for (var oldConn : gitHubConnectionRepository.findByGithubUsernameIgnoreCase(identity.login())) {
                    if (!linkUserId.equals(oldConn.getUserId())) {
                        for (RepositoryEntity repo : repositoryRepository.findByConnectionId(oldConn.getConnectionId())) {
                            repo.setConnectionId(activeConn.getConnectionId());
                            repositoryRepository.save(repo);
                        }
                        gitHubConnectionRepository.delete(oldConn);
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void autoSyncGitHubRepositories(Long workspaceId, GitHubConnectionEntity conn) {
        if (conn == null || conn.getConnectionId() == null) {
            return;
        }
        try {
            List<GitHubOAuthClient.GitHubRepoItem> ghRepos =
                    gitHubOAuthClient.fetchUserRepositories(conn.getAccessTokenEncrypted(), conn.getGithubUsername());
            for (GitHubOAuthClient.GitHubRepoItem item : ghRepos) {
                if (!StringUtils.hasText(item.fullName())) {
                    continue;
                }
                String fullName = item.fullName().trim();
                String name = StringUtils.hasText(item.name())
                        ? item.name().trim()
                        : (fullName.contains("/") ? fullName.substring(fullName.indexOf('/') + 1) : fullName);
                Long ghRepoId = item.id() != null ? item.id() : (long) Math.abs(fullName.hashCode());

                RepositoryEntity existing = repositoryRepository
                        .findByWorkspaceIdAndRepoFullName(workspaceId, fullName)
                        .orElseGet(() -> repositoryRepository
                                .findByWorkspaceIdAndGithubRepoId(workspaceId, ghRepoId)
                                .orElse(null));

                if (existing != null) {
                    existing.setConnectionId(conn.getConnectionId());
                    existing.setUpdatedAt(Instant.now());
                    repositoryRepository.save(existing);
                } else {
                    RepositoryEntity entity = RepositoryEntity.builder()
                            .workspaceId(workspaceId)
                            .connectionId(conn.getConnectionId())
                            .githubRepoId(ghRepoId)
                            .repoName(name)
                            .repoFullName(fullName)
                            .defaultBranch(StringUtils.hasText(item.defaultBranch()) ? item.defaultBranch().trim() : "main")
                            .cloneUrl(StringUtils.hasText(item.cloneUrl()) ? item.cloneUrl().trim() : "https://github.com/" + fullName + ".git")
                            .isActive(true)
                            .autoDocEnabled(true)
                            .createdAt(Instant.now())
                            .updatedAt(Instant.now())
                            .build();
                    repositoryRepository.save(entity);
                }
            }
        } catch (Exception ignored) {
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
        addCookie(response, "ld_oauth_link_user_id", "", 0);
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
