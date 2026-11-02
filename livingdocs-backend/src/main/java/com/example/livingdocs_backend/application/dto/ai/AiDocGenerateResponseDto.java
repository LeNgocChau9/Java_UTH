package com.example.livingdocs_backend.application.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.List;

/**
 * Response DTO nhận về từ API điều phối sinh tài liệu AI (/api/documents/generate-ai)
 * chứa cả thông tin tài liệu DRAFT đã tạo trong CSDL và kết quả Markdown từ AI Engine (/v1/docs/generate).
 */
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiDocGenerateResponseDto(
        Long docId,
        Long repoId,
        String title,
        String targetPath,
        String scope,
        String documentStatus,
        Integer currentVersion,
        String content,
        String contentHash,
        String sourceCommit,
        Integer linkedEntitiesCount,
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
