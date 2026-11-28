package com.example.livingdocs_backend.infrastructure.security;

import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ENTERPRISE_HEADER = "X-Enterprise-Id";

    private static final Set<String> PUBLIC_AUTH_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/refresh",
            "/api/auth/github",
            "/api/auth/github/callback",
            "/api/admin/users/forgot-password",
            "/api/health"
    );

    private final JwtTokenProvider tokenProvider;
    private final SpringDataUserRepository springDataUserRepository;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null && PUBLIC_AUTH_PATHS.contains(uri);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String token = resolveToken(request);

        if (StringUtils.hasText(token)) {
            boolean isValid = tokenProvider.validateToken(token);
            if (isValid) {
                try {
                    String email = tokenProvider.getEmailFromToken(token);
                    Long userId = tokenProvider.getUserIdFromToken(token);
                    List<String> roles = null;
                    Long workspaceId = tokenProvider.getWorkspaceIdFromToken(token);

                    if (userId != null) {
                        Optional<UserEntity> userOpt = Optional.empty();
                        try {
                            userOpt = springDataUserRepository.findById(userId);
                        } catch (Exception dbEx) {
                            log.debug("Không thể nạp user từ DB cho userId {}: {}", userId, dbEx.getMessage());
                        }

                        if (userOpt.isPresent()) {
                            UserEntity userEntity = userOpt.get();
                            String status = userEntity.getStatus() != null ? userEntity.getStatus().trim().toUpperCase() : "ACTIVE";
                            if (!"ACTIVE".equals(status)) {
                                SecurityContextHolder.clearContext();
                                writeAccountBlockedResponse(response, status, userEntity.getRejectionReason());
                                return;
                            }
                            workspaceId = userEntity.getWorkspaceId();
                        }

                        try {
                            List<String> dbRoles = springDataUserRepository.findRoleNamesByUserId(userId);
                            if (dbRoles != null && !dbRoles.isEmpty()) {
                                roles = dbRoles;
                            }
                        } catch (Exception dbEx) {
                            log.debug("Không thể nạp roles từ DB cho userId {}: {}", userId, dbEx.getMessage());
                        }
                    }

                    if (roles == null || roles.isEmpty()) {
                        roles = tokenProvider.getRolesFromToken(token);
                    }

                    boolean isAdmin = hasAdminRole(roles);
                    Long requestedEnterpriseId = isAdmin ? parseEnterpriseHeader(request) : null;

                    UserPrincipal userPrincipal = new UserPrincipal(userId, email, roles, workspaceId, requestedEnterpriseId);

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userPrincipal, null, userPrincipal.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (Exception ex) {
                    log.warn("Lỗi khi giải mã UserPrincipal từ token: {}", ex.getMessage());
                    SecurityContextHolder.clearContext();
                }
            } else {
                log.warn("Token không hợp lệ hoặc đã hết hạn cho request: {} {}", request.getMethod(),
                        request.getRequestURI());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        // Fallback cho EventSource (SSE) qua same-origin proxy: đọc từ cookie livingdocs_access_token
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("livingdocs_access_token".equals(cookie.getName()) && StringUtils.hasText(cookie.getValue())) {
                    return cookie.getValue();
                }
            }
        }
        // Fallback cho SSE /stream endpoints nếu truyền qua query parameter ?token=
        String uri = request.getRequestURI();
        if (uri != null && uri.endsWith("/stream")) {
            String queryToken = request.getParameter("token");
            if (StringUtils.hasText(queryToken)) {
                return queryToken.trim();
            }
        }
        return null;
    }

    private boolean hasAdminRole(List<String> roles) {
        if (roles == null) {
            return false;
        }
        for (String role : roles) {
            if (role == null) {
                continue;
            }
            String norm = role.trim().toUpperCase();
            if ("ADMIN".equals(norm) || "ROLE_ADMIN".equals(norm)) {
                return true;
            }
        }
        return false;
    }

    private Long parseEnterpriseHeader(HttpServletRequest request) {
        String raw = request.getHeader(ENTERPRISE_HEADER);
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            long id = Long.parseLong(raw.trim());
            return id > 0 ? id : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private void writeAccountBlockedResponse(HttpServletResponse response, String status, String rejectionReason) throws IOException {
        String errorCode;
        String message;
        switch (status) {
            case "PENDING" -> {
                errorCode = "ACCOUNT_PENDING";
                message = "Tài khoản của bạn đang chờ Quản trị viên phê duyệt. Vui lòng thử lại sau khi được duyệt.";
            }
            case "REJECTED" -> {
                errorCode = "ACCOUNT_REJECTED";
                message = StringUtils.hasText(rejectionReason)
                        ? "Yêu cầu đăng ký tài khoản của bạn đã bị Quản trị viên từ chối. Lý do: " + rejectionReason.trim()
                        : "Yêu cầu đăng ký tài khoản của bạn đã bị Quản trị viên từ chối.";
            }
            default -> {
                errorCode = "ACCOUNT_LOCKED";
                message = "Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ quản trị hệ thống.";
            }
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        String json = "{\"status\":403,\"error\":\"Forbidden\",\"errorCode\":\"" + escapeJson(errorCode)
                + "\",\"message\":\"" + escapeJson(message)
                + "\",\"timestamp\":\"" + Instant.now() + "\"}";
        response.getWriter().write(json);
    }

    private static String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
