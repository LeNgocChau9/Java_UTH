package com.example.livingdocs_backend.application.dto.drift;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftScanItemDto {

    @NotBlank(message = "file_path không được để trống")
    @Schema(description = "Đường dẫn file mã nguồn bị thay đổi", example = "src/main/java/com/example/OrderService.java")
    private String filePath;

    @Schema(description = "Mức độ nghiêm trọng: CRITICAL, HIGH, MEDIUM, LOW", example = "HIGH")
    private String severity;

    @Schema(description = "Đoạn code diff hoặc mô tả thay đổi", example = "- public void pay(Double a)\n+ public void pay(Double a, String c)")
    private String diffSnippet;

    @Schema(description = "Tên hàm bị thay đổi", example = "pay")
    private String methodName;

    @Schema(description = "Loại thay đổi: PARAM_CHANGED, DELETED, SIGNATURE_CHANGED, ...", example = "PARAM_CHANGED")
    private String changeType;

    @Schema(description = "ID tài liệu liên kết nếu đã xác định được trước", example = "10")
    private Long documentId;
}
