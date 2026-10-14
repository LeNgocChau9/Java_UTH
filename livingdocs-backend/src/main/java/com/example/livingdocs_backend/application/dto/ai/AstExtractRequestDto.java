package com.example.livingdocs_backend.application.dto.ai;

import lombok.Builder;

/**
 * Request DTO gửi sang FastAPI endpoint POST /v1/ast/extract.
 */
@Builder
public record AstExtractRequestDto(
        Long repository_id,
        String file_path,
        String source_code,
        String commit_hash
) {}
