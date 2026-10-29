package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.dashboard.DashboardStatsDto;
import com.example.livingdocs_backend.application.dto.dashboard.DashboardTrendItemDto;
import com.example.livingdocs_backend.application.port.DashboardServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard - Tech Lead Metrics", description = "API thống kê đo lường sức khỏe tài liệu và xu hướng cập nhật qua các PR")
public class DashboardController {

    private final DashboardServicePort dashboardServicePort;

    @GetMapping("/stats")
    @Operation(summary = "Lấy các chỉ số sức khỏe tài liệu tổng quan (Độ phủ %, Độ tươi mới %, Cảnh báo Drift)")
    public ResponseEntity<DashboardStatsDto> getStats() {
        return ResponseEntity.ok(dashboardServicePort.getDashboardStats());
    }

    @GetMapping("/trend")
    @Operation(summary = "Lấy dữ liệu xu hướng cập nhật tài liệu qua các đợt PR theo từng tuần")
    public ResponseEntity<List<DashboardTrendItemDto>> getTrend() {
        return ResponseEntity.ok(dashboardServicePort.getUpdateTrend());
    }
}

