package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplatePreviewResponse {

    @Schema(example = "1")
    private Long templateId;

    @Schema(example = "API Reference")
    private String templateName;

    @Schema(example = "API_REFERENCE")
    private String templateType;

    @Schema(description = "Markdown đã điền dữ liệu mẫu vào từng mục của template")
    private String markdown;
}
