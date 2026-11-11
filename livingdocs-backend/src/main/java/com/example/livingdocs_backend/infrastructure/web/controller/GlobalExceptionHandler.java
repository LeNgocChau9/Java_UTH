package com.example.livingdocs_backend.infrastructure.web.controller;

import lombok.extern.slf4j.Slf4j;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.EmailAlreadyExistsException;
import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Slf4j
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

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException ex) {
        HttpStatusCode status = ex.getStatusCode();
        Map<String, Object> error = new HashMap<>();
        error.put("status", status.value());
        error.put("error", HttpStatus.valueOf(status.value()).getReasonPhrase());
        error.put("message", ex.getReason() != null ? ex.getReason() : status.toString());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(status).body(error);
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

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleMethodArgumentTypeMismatchException(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", "Tham số yêu cầu không đúng định dạng: " + ex.getName());
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

    @ExceptionHandler(org.springframework.web.multipart.MultipartException.class)
    public ResponseEntity<Map<String, Object>> handleMultipartException(org.springframework.web.multipart.MultipartException ex) {
        log.warn("Multipart upload error: {}", ex.getMessage());
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", "Lỗi tải lên tệp tin: " + ex.getMessage());
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

    @ExceptionHandler(com.example.livingdocs_backend.domain.exception.UnauthorizedDocumentReviewException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorizedDocumentReviewException(com.example.livingdocs_backend.domain.exception.UnauthorizedDocumentReviewException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.FORBIDDEN.value());
        error.put("error", "Forbidden");
        error.put("message", ex.getMessage());
        if (ex.getCurrentStatus() != null) {
            error.put("currentStatus", ex.getCurrentStatus().name());
        }
        if (ex.getTargetStatus() != null) {
            error.put("targetStatus", ex.getTargetStatus().name());
        }
        if (ex.getActualRole() != null) {
            error.put("actualRole", ex.getActualRole());
        }
        if (ex.getRequiredRoles() != null && !ex.getRequiredRoles().isEmpty()) {
            error.put("requiredRoles", ex.getRequiredRoles());
        }
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
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
        // Không trả về HTTP 401 cho lỗi từ GitHub API để tránh Frontend hiểu nhầm là hết phiên đăng nhập JWT của LivingDocs
        boolean isExpiredOrUnauthorized = (ex.getStatusCode() == 401 || ex.getStatusCode() == 403);
        if (status == HttpStatus.UNAUTHORIZED) {
            status = HttpStatus.BAD_GATEWAY;
        }

        String safeMessage = isExpiredOrUnauthorized
                ? "Phiên đăng nhập đã hết hạn"
                : "Không thể đồng bộ dữ liệu từ GitHub lúc này. Vui lòng thử lại sau.";

        Map<String, Object> error = new HashMap<>();
        error.put("status", status.value());
        error.put("githubStatus", ex.getStatusCode());
        error.put("error", status.getReasonPhrase());
        error.put("errorCode", isExpiredOrUnauthorized ? "GITHUB_TOKEN_EXPIRED" : "GITHUB_API_ERROR");
        error.put("message", safeMessage);
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(status).body(error);
    }

    @ExceptionHandler(com.example.livingdocs_backend.domain.exception.DocumentNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleDocumentNotFoundException(com.example.livingdocs_backend.domain.exception.DocumentNotFoundException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.NOT_FOUND.value());
        error.put("error", "Not Found");
        error.put("message", ex.getMessage());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(com.example.livingdocs_backend.domain.exception.DocumentVersionNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleDocumentVersionNotFoundException(com.example.livingdocs_backend.domain.exception.DocumentVersionNotFoundException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.NOT_FOUND.value());
        error.put("error", "Not Found");
        error.put("message", ex.getMessage());
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolationException(org.springframework.dao.DataIntegrityViolationException ex) {
        log.error("Data integrity violation: {}", ex.getMessage(), ex);
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        String userFriendlyMessage;
        if (msg.contains("value too long") || msg.contains("too long for type") || msg.contains("22001")) {
            userFriendlyMessage = "Dữ liệu nhập vào quá dài hoặc vượt quá giới hạn ký tự cho phép.";
        } else if (msg.contains("unique constraint") || msg.contains("duplicate key") || msg.contains("23505")) {
            userFriendlyMessage = "Dữ liệu (email hoặc tên bản ghi) đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.";
        } else {
            userFriendlyMessage = "Dữ liệu bị xung đột hoặc vi phạm ràng buộc toàn vẹn của hệ thống. Vui lòng kiểm tra lại.";
        }

        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.CONFLICT.value());
        error.put("error", "Conflict");
        error.put("errorCode", "DATA_INTEGRITY_VIOLATION");
        error.put("message", userFriendlyMessage);
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessException(org.springframework.dao.DataAccessException ex) {
        log.error("Database access exception: {}", ex.getMessage(), ex);
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        error.put("error", "Database Error");
        error.put("errorCode", "DATABASE_ERROR");
        error.put("message", "Đã xảy ra sự cố khi truy vấn cơ sở dữ liệu. Vui lòng thử lại sau.");
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDeniedException(org.springframework.security.access.AccessDeniedException ex) {
        log.warn("Access Denied: {}", ex.getMessage());
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.FORBIDDEN.value());
        error.put("error", "Forbidden");
        error.put("errorCode", "ACCESS_DENIED");
        error.put("message", "Bạn không có quyền thực hiện thao tác này. Chức năng yêu cầu quyền Quản trị viên (Admin).");
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }

    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleSpringSecurityAuthenticationException(org.springframework.security.core.AuthenticationException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.UNAUTHORIZED.value());
        error.put("error", "Unauthorized");
        error.put("errorCode", "UNAUTHORIZED");
        error.put("message", "Yêu cầu xác thực tài khoản hợp lệ.");
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        log.error("Unhandled system error: ", ex);
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        error.put("error", "Internal Server Error");
        error.put("errorCode", "INTERNAL_SERVER_ERROR");
        error.put("message", "Đã xảy ra lỗi trong quá trình xử lý của hệ thống. Vui lòng thử lại sau.");
        error.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
