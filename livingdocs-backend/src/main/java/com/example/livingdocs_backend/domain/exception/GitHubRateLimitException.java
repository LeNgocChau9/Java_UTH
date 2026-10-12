package com.example.livingdocs_backend.domain.exception;

import lombok.Getter;

import java.time.Instant;

/**
 * Ngoại lệ ném ra khi GitHub API phản hồi HTTP 403 (Rate limit exceeded)
 * hoặc HTTP 429 (Too Many Requests).
 */
@Getter
public class GitHubRateLimitException extends RuntimeException {

    private final Instant resetTime;
    private final int limit;
    private final int remaining;

    public GitHubRateLimitException(String message, Instant resetTime, int limit, int remaining) {
        super(message);
        this.resetTime = resetTime;
        this.limit = limit;
        this.remaining = remaining;
    }

    public GitHubRateLimitException(String message) {
        this(message, null, 0, 0);
    }
}
