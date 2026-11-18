package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationRequest;
import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationResponse;

/**
 * Cổng giao tiếp cho Dịch vụ Thẩm định Chất lượng Tài liệu & Chống Ảo giác AI (Task Tuần 7).
 */
public interface DocQualityEvaluationServicePort {

    /**
     * Chấm điểm chất lượng tài liệu Markdown dựa trên 3 chỉ số thật:
     * (1) Entity & Param Coverage
     * (2) Anti-Hallucination Score (Quét và phát hiện Phantom Symbols)
     * (3) Template Compliance
     *
     * @param request thông tin Markdown, Repository, FilePath và Template
     * @return Báo cáo chi tiết điểm số, danh sách cảnh báo ảo giác và trạng thái PR Gate
     */
    DocumentQualityEvaluationResponse evaluateQuality(DocumentQualityEvaluationRequest request);
}
