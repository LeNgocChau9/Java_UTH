package com.example.livingdocs_backend.application.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Cảnh báo chất lượng tài liệu tổng hợp (Phân loại theo mức độ nghiêm trọng).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Cảnh báo chất lượng hoặc vi phạm PR Gate")
public class QualityWarningDto {

    @Schema(description = "Phân loại cảnh báo: HALLUCINATION, ENTITY_COVERAGE, PARAM_COVERAGE, TEMPLATE_COMPLIANCE", example = "HALLUCINATION")
    private String category;

    @Schema(description = "Mức độ nghiêm trọng: CRITICAL, HIGH, MEDIUM, LOW", example = "CRITICAL")
    private String severity;

    @Schema(description = "Tiêu đề ngắn gọn của cảnh báo", example = "Phát hiện ảo giác AI: Ký hiệu không có thực")
    private String title;

    @Schema(description = "Chi tiết cảnh báo", example = "Phương thức `fakeSecretMethod()` xuất hiện ở dòng 32 nhưng không có trong mã nguồn.")
    private String message;

    @Schema(description = "Hành động khuyến nghị để khắc phục", example = "Xóa bỏ hoặc thay thế bằng phương thức thực tế có trong Controller.")
    private String actionRequired;
}
