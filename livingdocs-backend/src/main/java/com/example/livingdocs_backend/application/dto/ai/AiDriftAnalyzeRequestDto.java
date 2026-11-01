package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO yêu cầu phân tích sai lệch ngữ nghĩa (Semantic Drift) gửi sang AI Engine (/v1/drift/analyze).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiDriftAnalyzeRequestDto {
    private String code_diff;
    private String current_doc;
    private String entity_name;
    private String entity_type;
    private String file_path;
    private Long document_id;
    private Long repository_id;
    private Integer pr_number;
    private String commit_hash;
}

