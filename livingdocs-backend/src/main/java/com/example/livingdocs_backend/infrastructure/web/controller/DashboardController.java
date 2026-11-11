package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.DashboardStatsResponse;
import com.example.livingdocs_backend.application.dto.DashboardTrendResponse;
import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.port.DocumentHealthReportServicePort;
import com.example.livingdocs_backend.application.service.DashboardStatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Dashboard - Sức khỏe tài liệu", description = "Số liệu bao phủ, độ mới của tài liệu và cảnh báo drift")
public class DashboardController {

    private final DashboardStatsService dashboardStatsService;
    private final DocumentHealthReportServicePort healthReportServicePort;

    @GetMapping("/stats")
    @Operation(
            summary = "Thống kê chỉ số sức khỏe tài liệu",
            description = "Tổng class/hàm đã quét, số entity đã có tài liệu, coverage %, freshness % theo commit mới nhất, "
                    + "và số cảnh báo drift OPEN theo mức độ. Cần JWT. Thêm repositoryId để lọc một kho."
    )
    public ResponseEntity<DashboardStatsResponse> stats(
            @Parameter(description = "ID kho. Bỏ trống để thống kê toàn hệ thống.")
            @RequestParam(required = false) Long repositoryId
    ) {
        if (repositoryId != null && repositoryId <= 0) {
            throw new IllegalArgumentException("repositoryId phải là số dương");
        }
        return ResponseEntity.ok(dashboardStatsService.getStats(repositoryId));
    }

    @GetMapping("/trend")
    @Operation(
            summary = "Lịch sử xu hướng tài liệu theo tuần",
            description = "Mảng tuần liên tục để vẽ biểu đồ: tài liệu tạo mới, số lần cập nhật (phiên bản từ 2 trở đi) "
                    + "và số cảnh báo phát sinh. PostgreSQL gom bằng date_trunc('week') trong một câu query. Cần JWT."
    )
    public ResponseEntity<DashboardTrendResponse> trend(
            @Parameter(description = "Số tuần, tính lùi từ tuần hiện tại. Mặc định 12, tối đa 52.")
            @RequestParam(required = false, defaultValue = "12") int weeks,
            @Parameter(description = "ID kho. Bỏ trống để thống kê toàn hệ thống.")
            @RequestParam(required = false) Long repositoryId
    ) {
        if (repositoryId != null && repositoryId <= 0) {
            throw new IllegalArgumentException("repositoryId phải là số dương");
        }
        return ResponseEntity.ok(dashboardStatsService.getTrend(repositoryId, weeks));
    }

    @GetMapping("/health-report")
    @Operation(
            summary = "Báo cáo tổng hợp tình trạng sức khỏe tài liệu",
            description = "Endpoint alias từ dashboard cho báo cáo sức khỏe tài liệu, hỗ trợ format=markdown để xuất báo cáo sẵn bảng biểu."
    )
    public ResponseEntity<?> healthReport(
            @Parameter(description = "ID kho. Bỏ trống để thống kê toàn hệ thống.")
            @RequestParam(required = false) Long repositoryId,
            @Parameter(description = "Định dạng kết quả trả về. Chọn 'markdown' hoặc 'md' để nhận văn bản Markdown hoàn chỉnh. Mặc định trả về JSON.")
            @RequestParam(required = false, defaultValue = "json") String format
    ) {
        if (repositoryId != null && repositoryId <= 0) {
            throw new IllegalArgumentException("repositoryId phải là số dương");
        }

        if ("markdown".equalsIgnoreCase(format) || "md".equalsIgnoreCase(format)) {
            String markdown = healthReportServicePort.exportHealthReportMarkdown(repositoryId);
            String filename = repositoryId != null
                    ? "document-health-report-repo-" + repositoryId + ".md"
                    : "document-health-report-system.md";

            return ResponseEntity.ok()
                    .contentType(new MediaType("text", "markdown", StandardCharsets.UTF_8))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(markdown);
        }

        return ResponseEntity.ok(healthReportServicePort.generateHealthReport(repositoryId));
    }
}
