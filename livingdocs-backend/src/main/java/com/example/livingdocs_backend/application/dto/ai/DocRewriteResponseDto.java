package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocRewriteResponseDto {
    private String status;
    private String mode;
    private Integer original_doc_length;
    private Integer rewritten_doc_length;
    private String updated_doc;
    private String summary_of_changes;
    private Integer modified_sections_count;
    private Integer unchanged_sections_count;
    private List<SectionDiffDto> section_diffs;
    private String model_used;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SectionDiffDto {
        private String section_title;
        private String status;
        private String old_content;
        private String new_content;
        private String change_reason;
    }
}

