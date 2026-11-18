package com.example.livingdocs_backend.application.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload yêu cầu chấm điểm chất lượng tài liệu và phát hiện ảo giác AI.
 * (POST /v1/docs/evaluate-quality)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu chấm điểm chất lượng tài liệu kỹ thuật & kiểm soát ảo giác AI")
public class DocumentQualityEvaluationRequest {

    @Schema(description = "Mã định danh kho lưu trữ mã nguồn (Repository ID)", example = "1")
    private Long repositoryId;

    @Schema(description = "Mã định danh tài liệu trong hệ thống (Tùy chọn nếu đang thẩm định tài liệu đã lưu)", example = "42")
    private Long documentId;

    @Schema(description = "Đường dẫn file mã nguồn liên quan (Tùy chọn để thu hẹp phạm vi AST)", example = "src/main/java/com/example/service/UserService.java")
    private String filePath;

    @Schema(description = "Nội dung văn bản Markdown cần thẩm định chất lượng", example = "# API User Service\n\n## 1. Tổng quan...")
    private String markdown;

    @Schema(description = "Mã mẫu tài liệu chuẩn (DocTemplate ID) để đối chiếu đề mục", example = "1")
    private Long templateId;

    @Schema(description = "Ngưỡng điểm chất lượng tối thiểu để đạt điều kiện PR Gate (0.0 - 1.0)", example = "0.75")
    private Double minQualityThreshold;

    @Schema(description = "Ngưỡng điểm chống ảo giác tối thiểu (0.0 - 1.0)", example = "0.80")
    private Double minAntiHallucinationThreshold;
}
