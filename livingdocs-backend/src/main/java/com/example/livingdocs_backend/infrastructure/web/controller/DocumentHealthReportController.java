package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.port.DocumentHealthReportServicePort;
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
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Document Health Report", description = "API Tổng hợp & Xuất Báo cáo Tình trạng Sức khỏe Tài liệu")
public class DocumentHealthReportController {

    private final DocumentHealthReportServicePort healthReportServicePort;

    @GetMapping("/health")
    @Operation(
            summary = "Tổng hợp & xuất báo cáo tình trạng sức khỏe tài liệu",
            description = "Tổng hợp toàn diện các chỉ số: tỷ lệ bao phủ, độ mới theo commit mới nhất, số lượng hàm và lớp còn thiếu tài liệu, "
                    + "phân loại cảnh báo sai lệch từ thấp đến nghiêm trọng và đánh giá mức độ tuân thủ theo thang điểm chuẩn. "
                    + "Hỗ trợ tham số format=markdown để trả về trực tiếp nội dung văn bản Markdown hoàn chỉnh có sẵn bảng biểu sẵn sàng tải về. "
                    + "Phản hồi nhanh dưới 300ms cho toàn hệ thống hoặc theo từng kho lưu trữ."
    )
    public ResponseEntity<?> getDocumentHealthReport(
            @Parameter(description = "ID kho lưu trữ. Bỏ trống để báo cáo toàn bộ hệ thống.")
            @RequestParam(required = false) Long repositoryId,
            @Parameter(description = "Định dạng kết quả trả về. Chọn 'markdown' hoặc 'md' để nhận văn bản Markdown hoàn chỉnh. Mặc định trả về JSON.")
            @RequestParam(required = false, defaultValue = "json") String format
    ) {
        if (repositoryId != null && repositoryId <= 0) {
            throw new IllegalArgumentException("repositoryId phải là số nguyên dương");
        }

        if ("markdown".equalsIgnoreCase(format) || "md".equalsIgnoreCase(format)) {
            String markdownContent = healthReportServicePort.exportHealthReportMarkdown(repositoryId);
            String filename = repositoryId != null
                    ? "document-health-report-repo-" + repositoryId + ".md"
                    : "document-health-report-system.md";

            return ResponseEntity.ok()
                    .contentType(new MediaType("text", "markdown", StandardCharsets.UTF_8))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(markdownContent);
        }

        DocumentHealthReportResponse report = healthReportServicePort.generateHealthReport(repositoryId);
        return ResponseEntity.ok(report);
    }
}
