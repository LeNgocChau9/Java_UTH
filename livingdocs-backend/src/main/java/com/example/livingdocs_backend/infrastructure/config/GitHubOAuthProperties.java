package com.example.livingdocs_backend.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Cấu hình GitHub OAuth2 (luồng Authorization Code do backend tự điều phối).
 * Đọc từ application.properties / biến môi trường. Nếu client-id/secret trống
 * thì coi như chức năng "Đăng nhập bằng GitHub" chưa được cấu hình.
 */
@Component
public class GitHubOAuthProperties {

    @Value("${github.oauth.client-id:}")
    private String clientId;

    @Value("${github.oauth.client-secret:}")
    private String clientSecret;

    @Value("${github.oauth.redirect-uri:http://localhost:8080/api/auth/github/callback}")
    private String redirectUri;

    @Value("${github.oauth.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${github.oauth.scope:read:user user:email}")
    private String scope;

    public String getClientId() {
        return clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public String getFrontendUrl() {
        return frontendUrl;
    }

    public String getScope() {
        return scope;
    }

    /** Trang đăng nhập phía frontend (dùng khi OAuth lỗi / chưa cấu hình). */
    public String getLoginUrl() {
        return frontendUrl + "/login";
    }

    /** Trang nhận token phía frontend sau khi backend đã cấp JWT. */
    public String getFrontendCallbackUrl() {
        return frontendUrl + "/oauth/callback";
    }

    public boolean isConfigured() {
        return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
    }
}
