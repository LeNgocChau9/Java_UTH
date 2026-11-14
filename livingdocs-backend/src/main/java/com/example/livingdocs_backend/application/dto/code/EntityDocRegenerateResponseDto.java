package com.example.livingdocs_backend.application.dto.code;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO trả về kết quả tạo lại tài liệu cho một thực thể mã nguồn cụ thể
 * kèm thông tin phiên bản nháp (DRAFT DocumentVersion) mới nhất.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntityDocRegenerateResponseDto {
    private Long versionId;
    private Long documentId;
    private String documentTitle;
    private String targetPath;
    private Integer versionNumber;
    private String contentHash;
    private String previousHash;
    private Long entityId;
    private Long repositoryId;
    private String filePath;
    private String entityType;
    private String className;
    private String methodName;
    private String signature;
    private String returnType;
    private String parameters;
    private Integer startLine;
    private Integer endLine;
    private String docStatus;
    private String status;
    private String updatedSectionMarkdown;
    private String fullMarkdown;
    private String summaryOfChanges;
    private String mode;
}
