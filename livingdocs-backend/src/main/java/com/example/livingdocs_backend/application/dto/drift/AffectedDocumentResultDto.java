package com.example.livingdocs_backend.application.dto.drift;

import lombok.Builder;

import java.util.List;

/**
 * DTO chứa thông tin các tài liệu bị ảnh hưởng bởi thay đổi mã nguồn trong PR.
 */
@Builder
public record AffectedDocumentResultDto(
        Long documentId,
        String documentTitle,
        String documentPath,
        String relatedFilePath,
        String className,
        String methodName,
        String changeType,
        String severity,
        String details
) {}
