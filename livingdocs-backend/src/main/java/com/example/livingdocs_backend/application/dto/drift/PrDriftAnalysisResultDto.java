package com.example.livingdocs_backend.application.dto.drift;

import lombok.Builder;

import java.util.List;

/**
 * DTO trả về kết quả quy trình tìm tài liệu bị ảnh hưởng và tự động comment lên PR.
 */
@Builder
public record PrDriftAnalysisResultDto(
        Long repositoryId,
        Integer prNumber,
        String repoFullName,
        int totalChangesDetected,
        int totalAffectedDocs,
        List<AffectedDocumentResultDto> affectedDocuments,
        Long commentId,
        String commentUrl,
        String status,
        String message
) {}
