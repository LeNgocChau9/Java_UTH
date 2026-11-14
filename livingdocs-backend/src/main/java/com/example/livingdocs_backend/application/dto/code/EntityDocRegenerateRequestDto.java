package com.example.livingdocs_backend.application.dto.code;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO cho tính năng Tạo lại tài liệu cho một thực thể mã nguồn cụ thể từ Cây mã nguồn (/cay-ma-nguon).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntityDocRegenerateRequestDto {
    private Long entityId;
    private Long repositoryId;
    private Long documentId;
    private String filePath;
    private String entityType;
    private String className;
    private String methodName;
    private String signature;
    private String returnType;
    private String parameters;
    private Integer startLine;
    private Integer endLine;
    private String javadoc;
    private String sourceCode;
    private String commitHash;
    private String instruction;
}
