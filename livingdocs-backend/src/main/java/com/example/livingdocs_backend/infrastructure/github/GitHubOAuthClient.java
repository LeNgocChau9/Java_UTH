package com.example.livingdocs_backend.infrastructure.github;

import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.infrastructure.config.GitHubOAuthProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Arrays;

/**
 * Client gọi GitHub OAuth2 + REST API để lấy danh tính người dùng.
 * Dùng RestClient (Spring Boot 3.3 / Spring Framework 6.1).
 */
@Component
@RequiredArgsConstructor
public class GitHubOAuthClient {

    private static final String AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
    private static final String TOKEN_URL = "https://github.com/login/oauth/access_token";
    private static final String USER_URL = "https://api.github.com/user";
    private static final String EMAILS_URL = "https://api.github.com/user/emails";
    private static final String API_VERSION = "2022-11-28";

    private final GitHubOAuthProperties config;
    private final RestClient restClient = RestClient.builder().build();

    public boolean isConfigured() {
        return config.isConfigured();
    }

    /** Sinh URL chuyển hướng trình duyệt sang trang cho phép của GitHub (luôn yêu cầu đăng nhập và cấp quyền mới). */
    public String buildAuthorizeUrl(String state) {
        return UriComponentsBuilder.fromHttpUrl(AUTHORIZE_URL)
                .queryParam("client_id", config.getClientId())
                .queryParam("redirect_uri", config.getRedirectUri())
                .queryParam("scope", config.getScope())
                .queryParam("state", state)
                .queryParam("prompt", "login")
                .queryParam("allow_signup", "true")
                .build()
                .encode()
                .toUriString();
    }

    /** Trao đổi code lấy access_token rồi đọc thông tin người dùng GitHub. */
    public GitHubIdentity fetchIdentity(String code) {
        String accessToken = exchangeCodeForAccessToken(code);
        GitHubUser user = fetchUser(accessToken);
        String email = resolveEmail(user, accessToken);
        return new GitHubIdentity(user.id(), user.login(), user.name(), email, user.avatarUrl(), accessToken);
    }

    private String exchangeCodeForAccessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", config.getClientId());
        form.add("client_secret", config.getClientSecret());
        form.add("code", code);
        form.add("redirect_uri", config.getRedirectUri());

        GitHubTokenResponse tokenResponse = restClient.post()
                .uri(TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(form)
                .retrieve()
                .body(GitHubTokenResponse.class);

        if (tokenResponse == null || !StringUtils.hasText(tokenResponse.accessToken())) {
            String desc = (tokenResponse != null && StringUtils.hasText(tokenResponse.errorDescription()))
                    ? tokenResponse.errorDescription()
                    : "Không nhận được access token từ GitHub";
            throw new AuthenticationException(desc);
        }
        return tokenResponse.accessToken();
    }

    private GitHubUser fetchUser(String accessToken) {
        GitHubUser user = restClient.get()
                .uri(USER_URL)
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/json")
                .header("X-GitHub-Api-Version", API_VERSION)
                .retrieve()
                .body(GitHubUser.class);

        if (user == null || user.id() == null) {
            throw new AuthenticationException("Không đọc được thông tin người dùng GitHub");
        }
        return user;
    }

    private String resolveEmail(GitHubUser user, String accessToken) {
        if (StringUtils.hasText(user.email())) {
            return user.email().toLowerCase().trim();
        }
        try {
            GitHubEmail[] emails = restClient.get()
                    .uri(EMAILS_URL)
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Accept", "application/json")
                    .header("X-GitHub-Api-Version", API_VERSION)
                    .retrieve()
                    .body(GitHubEmail[].class);

            if (emails != null) {
                String primary = Arrays.stream(emails)
                        .filter(e -> Boolean.TRUE.equals(e.primary()) && Boolean.TRUE.equals(e.verified()))
                        .map(GitHubEmail::email)
                        .findFirst()
                        .orElse(null);
                if (StringUtils.hasText(primary)) {
                    return primary.toLowerCase().trim();
                }
                String anyVerified = Arrays.stream(emails)
                        .filter(e -> Boolean.TRUE.equals(e.verified()))
                        .map(GitHubEmail::email)
                        .findFirst()
                        .orElse(null);
                if (StringUtils.hasText(anyVerified)) {
                    return anyVerified.toLowerCase().trim();
                }
            }
        } catch (Exception ignored) {
            // Không đọc được email thì rơi về noreply bên dưới.
        }
        return user.login() + "@users.noreply.github.com";
    }

    /** Danh tính người dùng GitHub đã được chuẩn hóa (dùng ở tầng application). */
    public record GitHubIdentity(Long id, String login, String name, String email, String avatarUrl, String accessToken) {}

    public record GitHubUser(
            Long id,
            String login,
            String name,
            String email,
            @JsonProperty("avatar_url") String avatarUrl
    ) {}

    public record GitHubEmail(String email, Boolean primary, Boolean verified) {}

    public record GitHubTokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType,
            String scope,
            String error,
            @JsonProperty("error_description") String errorDescription
    ) {}
}
