package com.example.livingdocs_backend.domain.exception;

import org.springframework.http.HttpStatus;

public class AuthenticationException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus httpStatus;

    public AuthenticationException(String message) {
        this(message, null, HttpStatus.UNAUTHORIZED);
    }

    public AuthenticationException(String message, String errorCode, HttpStatus httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus != null ? httpStatus : HttpStatus.UNAUTHORIZED;
    }

    public static AuthenticationException unauthorized(String message) {
        return new AuthenticationException(message, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }

    public static AuthenticationException forbidden(String errorCode, String message) {
        return new AuthenticationException(message, errorCode, HttpStatus.FORBIDDEN);
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
