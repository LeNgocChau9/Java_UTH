package com.example.livingdocs_backend.domain.exception;

import lombok.Getter;

/**
 * Ngoại lệ chung cho các lỗi tương tác với GitHub REST API (404 Not Found, 401 Unauthorized, 500, v.v.).
 */
@Getter
public class GitHubApiException extends RuntimeException {

    private final int statusCode;

    public GitHubApiException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }

    public GitHubApiException(String message, int statusCode, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
    }
}
