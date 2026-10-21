package com.example.livingdocs_backend.application.dto.github;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Kết quả kiểm tra tính hợp lệ của GitHub Token.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubTokenValidationResult {

    /** Token có hợp lệ và hoạt động tốt hay không. */
    private boolean valid;

    /** Trạng thái token: CONNECTED, EXPIRED, REVOKED, INVALID. */
    private String status;

    /** Tên đăng nhập GitHub gắn liền với token (nếu hợp lệ). */
    private String githubUsername;

    /** Quyền hạn (scopes) của token. */
    private String scopes;

    /** Thời điểm hết hạn của token nếu GitHub trả về trong header (OAuth token). */
    private Instant expiresAt;

    /** Thông báo chi tiết hoặc cảnh báo lỗi. */
    private String message;
}
