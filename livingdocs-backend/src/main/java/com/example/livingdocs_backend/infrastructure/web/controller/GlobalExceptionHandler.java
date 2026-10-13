package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.EmailAlreadyExistsException;
import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthenticationException(AuthenticationException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.UNAUTHORIZED.value());
        error.put("error", "Unauthorized");
        error.put("message", ex.getMessage());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<Map<String, Object>> handleEmailAlreadyExistsException(EmailAlreadyExistsException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.CONFLICT.value());
        error.put("error", "Conflict");
        error.put("message", ex.getMessage());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }

        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", "Dữ liệu gửi lên không hợp lệ");
        error.put("fieldErrors", fieldErrors);
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", ex.getMessage());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(InvalidDocumentStatusTransitionException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidDocumentStatusTransitionException(InvalidDocumentStatusTransitionException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Invalid Status Transition");
        error.put("message", ex.getMessage());
        if (ex.getFromStatus() != null) {
            error.put("fromStatus", ex.getFromStatus().name());
        }
        if (ex.getToStatus() != null) {
            error.put("toStatus", ex.getToStatus().name());
        }
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(com.example.livingdocs_backend.domain.exception.GitHubRateLimitException.class)
    public ResponseEntity<Map<String, Object>> handleGitHubRateLimitException(com.example.livingdocs_backend.domain.exception.GitHubRateLimitException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.TOO_MANY_REQUESTS.value());
        error.put("error", "Rate Limit Exceeded");
        error.put("message", ex.getMessage());
        if (ex.getResetTime() != null) {
            error.put("resetTime", ex.getResetTime().toString());
        }
        error.put("limit", ex.getLimit());
        error.put("remaining", ex.getRemaining());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(error);
    }

    @ExceptionHandler(com.example.livingdocs_backend.domain.exception.GitHubApiException.class)
    public ResponseEntity<Map<String, Object>> handleGitHubApiException(com.example.livingdocs_backend.domain.exception.GitHubApiException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        Map<String, Object> error = new HashMap<>();
        error.put("status", status.value());
        error.put("error", status.getReasonPhrase());
        error.put("message", ex.getMessage());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(status).body(error);
    }
}

