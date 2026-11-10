package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.AuditCleanupResultDto;
import com.example.livingdocs_backend.application.dto.AuditRetentionConfigDto;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditLog;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@PreAuthorize("hasAnyRole('TECH_LEAD','ADMIN')")
@Tag(name = "Audit logs", description = "Nhật ký kiểm toán cho Quản trị viên và Trưởng nhóm kỹ thuật")
public class AuditLogController {

    private final AuditServicePort auditServicePort;

    @GetMapping
    @Operation(summary = "Lọc nhật ký kiểm toán", description = "Chỉ TECH_LEAD và ADMIN. Lọc theo action và khoảng thời gian.")
    public List<AuditLog> search(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return auditServicePort.search(action, from, to);
    }

    @GetMapping("/retention/config")
    @Operation(summary = "Xem cấu hình chính sách lưu trữ nhật ký kiểm toán", description = "Lấy thời hạn lưu trữ (ngày), trạng thái tự động dọn dẹp và thông tin lần dọn dẹp gần nhất.")
    public ResponseEntity<AuditRetentionConfigDto> getRetentionConfig() {
        return ResponseEntity.ok(auditServicePort.getRetentionConfig());
    }

    @PutMapping("/retention/config")
    @Operation(summary = "Cập nhật chính sách lưu trữ nhật ký kiểm toán", description = "Cấu hình số ngày lưu trữ (30 - 365 ngày), bật/tắt dọn dẹp tự động và chu kỳ cron.")
    public ResponseEntity<AuditRetentionConfigDto> updateRetentionConfig(
            @Valid @RequestBody AuditRetentionConfigDto request,
            Authentication authentication) {
        Long actorId = parseActorId(authentication);
        return ResponseEntity.ok(auditServicePort.updateRetentionConfig(request, actorId));
    }

    @PostMapping("/cleanup")
    @Operation(summary = "Dọn dẹp nhật ký kiểm toán thủ công", description = "Xóa an toàn các bản ghi audit_logs và changelogs cũ hơn số ngày chỉ định (hoặc theo cấu hình mặc định) và tự động ghi nhật ký kiểm toán AUDIT_LOG_CLEANUP.")
    public ResponseEntity<AuditCleanupResultDto> triggerManualCleanup(
            @RequestParam(required = false) Integer retentionDays,
            Authentication authentication) {
        Long actorId = parseActorId(authentication);
        return ResponseEntity.ok(auditServicePort.cleanupExpiredLogs(retentionDays, actorId, "MANUAL_API"));
    }

    private Long parseActorId(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
