package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationRequest;
import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationResponse;
import com.example.livingdocs_backend.application.port.DocQualityEvaluationServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller cung cấp API Thẩm định Chất lượng Tài liệu & Cổng Chống Ảo Giác AI (Anti-Hallucination Gate).
 * Đáp ứng đặc tả: POST /v1/docs/evaluate-quality (Task Tuần 7).
 */
@RestController
@RequestMapping({"/v1/docs", "/api/v1/docs", "/api/documents"})
@PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
@RequiredArgsConstructor
@Tag(name = "Document Quality & Anti-Hallucination Gate", description = "Chấm điểm chất lượng tài liệu Markdown dựa trên AST thật và phát hiện ký hiệu ảo giác (Phantom Symbols)")
public class DocQualityEvaluationController {

    private final DocQualityEvaluationServicePort qualityEvaluationService;

    @PostMapping("/evaluate-quality")
    @Operation(
            summary = "Chấm điểm chất lượng tài liệu & phát hiện ảo giác AI",
            description = "Xóa bỏ confidence_score gán cứng. Đối chiếu nội dung Markdown với danh sách code_entities thật từ AST. " +
                          "Tính 3 chỉ số thật: (1) Entity & Param Coverage, (2) Anti-Hallucination Score (quét backtick symbols/tên hàm/API path phát hiện Phantom Symbols), (3) Template Compliance. " +
                          "Trả về chi tiết từng cảnh báo ảo giác/thiếu sót và xác định điều kiện chặn PR Gate."
    )
    public ResponseEntity<DocumentQualityEvaluationResponse> evaluateQuality(
            @Valid @RequestBody DocumentQualityEvaluationRequest request
    ) {
        DocumentQualityEvaluationResponse response = qualityEvaluationService.evaluateQuality(request);
        return ResponseEntity.ok(response);
    }
}
