package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;

public interface DocumentHealthReportServicePort {

    /**
     * Tạo báo cáo tổng hợp tình trạng sức khỏe tài liệu.
     *
     * @param repositoryId null nghĩa là toàn bộ hệ thống
     * @return Báo cáo sức khỏe tài liệu chi tiết
     */
    DocumentHealthReportResponse generateHealthReport(Long repositoryId);

    /**
     * Xuất báo cáo tình trạng sức khỏe tài liệu dưới định dạng Markdown hoàn chỉnh với bảng biểu.
     *
     * @param repositoryId null nghĩa là toàn bộ hệ thống
     * @return Nội dung tài liệu định dạng Markdown
     */
    String exportHealthReportMarkdown(Long repositoryId);
}
