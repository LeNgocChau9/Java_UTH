package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Domain model đại diện cho một phần tử mã nguồn (Class, Method, Constructor...)
 * được bóc tách từ AST trong hệ thống LivingDocs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodeEntity {
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
    private String commitHash;
    private String docStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
