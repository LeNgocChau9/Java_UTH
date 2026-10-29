package com.example.livingdocs_backend.application.dto.ai;

import lombok.Builder;

import java.util.List;

/**
 * Request DTO gửi sang AI Engine (/v1/ast/diff) để đối chiếu AST giữa các file Java trong Pull Request.
 */
@Builder
public record AstDiffRequestDto(
        Long repository_id,
        Integer pr_number,
        String base_commit_hash,
        String head_commit_hash,
        List<FileDiffItemDto> files
) {
    @Builder
    public record FileDiffItemDto(
            String file_path,
            String base_code,
            String head_code
    ) {}
}
