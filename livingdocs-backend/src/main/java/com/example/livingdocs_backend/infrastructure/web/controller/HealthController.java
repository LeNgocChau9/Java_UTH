package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.service.DetailedHealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Health Check", description = "Endpoints kiểm tra trạng thái hoạt động của hệ thống")
public class HealthController {

    private final DetailedHealthService detailedHealthService;

    @GetMapping("/health")
    @Operation(summary = "Kiểm tra sức khỏe dịch vụ", description = "Trả về trạng thái hoạt động UP của dịch vụ LivingDocs Backend")
    public ResponseEntity<Map<String, Object>> getHealthStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "livingdocs-backend");
        response.put("version", "v1.0.0");
        response.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health/detailed")
    @PreAuthorize("hasAnyRole('ADMIN', 'TECH_LEAD')")
    @Operation(
            summary = "Telemetry chi tiết toàn hệ thống",
            description = "Kiểm tra kết nối & độ trễ thực tế tới PostgreSQL (pgvector), GitHub API rate-limit, AI Engine providers + quota metrics và 10 nhật ký audit gần nhất"
    )
    public ResponseEntity<Map<String, Object>> getDetailedHealthStatus() {
        return ResponseEntity.ok(detailedHealthService.collectDetailedHealth());
    }
}
