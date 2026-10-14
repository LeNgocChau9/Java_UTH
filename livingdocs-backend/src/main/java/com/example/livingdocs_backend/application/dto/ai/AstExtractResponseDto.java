package com.example.livingdocs_backend.application.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.List;

/**
 * Response DTO nhận từ FastAPI endpoint POST /v1/ast/extract.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Builder
public record AstExtractResponseDto(
        String status,
        String mode,
        String file_path,
        String commit_hash,
        Integer total_entities,
        List<CodeEntityItemDto> entities
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
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
            String javadoc
    ) {}
}
