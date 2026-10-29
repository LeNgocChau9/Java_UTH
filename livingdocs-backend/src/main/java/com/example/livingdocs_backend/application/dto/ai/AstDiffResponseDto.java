package com.example.livingdocs_backend.application.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.List;

/**
 * Response DTO nhận từ AI Engine (/v1/ast/diff) chứa kết quả đối chiếu hàm bị thay đổi, xóa, đổi tên, đổi tham số.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Builder
public record AstDiffResponseDto(
        String status,
        Long repository_id,
        Integer pr_number,
        String base_commit_hash,
        String head_commit_hash,
        Integer total_files_analyzed,
        Integer total_affected_entities,
        List<FileDiffResultDto> files
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Builder
    public record FileDiffResultDto(
            String file_path,
            String file_status,
            String class_name,
            Integer total_affected,
            DiffSummaryDto summary,
            List<AffectedEntityItemDto> affected_entities
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Builder
    public record DiffSummaryDto(
            int added,
            int deleted,
            int renamed,
            int modified
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Builder
    public record AffectedEntityItemDto(
            String entity_type,
            String class_name,
            String method_name,
            String change_type,
            String impact_level,
            String old_signature,
            String new_signature,
            String old_parameters,
            String new_parameters,
            String old_return_type,
            String new_return_type,
            Integer start_line,
            Integer end_line,
            String details
    ) {}
}
