package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentCrossCheckRequest {

    @Schema(description = "ID của mẫu tài liệu chuẩn trong doc_templates (tùy chọn, mặc định lấy template mặc định)")
    private Long templateId;

    @NotNull(message = "repositoryId không được để trống")
    @Schema(description = "ID của repository liên kết với tài liệu", example = "1")
    private Long repositoryId;

    @NotNull(message = "Nội dung Markdown/Word không được để trống")
    @Schema(description = "Nội dung tài liệu Markdown (đã chuyển đổi từ file Word .docx)")
    private String markdown;

    @Schema(description = "Đường dẫn tệp đích (targetPath), ví dụ: docs/payment-service.md")
    private String targetPath;
}
