package com.example.livingdocs_backend.application.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.List;

/**
 * Response DTO nhận về từ AI Engine (/v1/docs/generate) chứa Markdown do Google Gemini sinh.
 */
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiDocGenerateResponseDto(
        String status,
        String mode,
        String template_type,
        String file_path,
        String generated_content,
        Double confidence_score,
        List<GroundingEvidenceDto> grounding_evidence
) {
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GroundingEvidenceDto(
            String file_path,
            String class_name,
            String method_name,
            Integer start_line,
            Integer end_line,
            String commit_hash
    ) {}
}

