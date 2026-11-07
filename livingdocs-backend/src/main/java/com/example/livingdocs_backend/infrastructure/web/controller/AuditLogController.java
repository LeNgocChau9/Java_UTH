package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditLog;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}
