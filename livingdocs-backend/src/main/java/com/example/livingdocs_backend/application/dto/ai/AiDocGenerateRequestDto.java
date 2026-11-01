package com.example.livingdocs_backend.application.dto.ai;

import lombok.Builder;

import java.util.List;

/**
 * Request DTO gửi sang AI Engine (/v1/docs/generate) để sinh tài liệu kỹ thuật hoàn chỉnh từ AST.
 */
@Builder
public record AiDocGenerateRequestDto(
        String template_type,
        String file_path,
        String class_name,
        String source_code,
        List<CodeEntityItemDto> entities
) {
    @Builder
    public record CodeEntityItemDto(
            String entity_type,
            String class_name,
            String method_name,
            String signature,
            String return_type,
            String parameters,
            Integer start_line,
            Integer end_line,
            String doc_status,
            String javadoc,
            List<String> annotations
    ) {}
}

