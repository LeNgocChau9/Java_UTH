package com.example.livingdocs_backend.application.dto.drift;

import lombok.Builder;

/**
 * Task tuần 7: DTO chứa thông tin các tài liệu bị ảnh hưởng kèm vị trí dòng và chữ ký hàm để tạo suggestion patches.
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
                String details,
                Integer startLine,
                Integer endLine,
                String oldSignature,
                String newSignature) {
}
