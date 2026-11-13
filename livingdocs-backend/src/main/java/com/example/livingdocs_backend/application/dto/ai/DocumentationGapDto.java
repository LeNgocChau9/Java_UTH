package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO đại diện cho một phần tử mã nguồn chưa có tài liệu (Khoảng trống tài liệu
 * - Documentation Gap).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentationGapDto {

    private Long entityId;
    private Long repositoryId;
    private String repoName;
    private String repoFullName;
    private String filePath;
    private String packagePath;
    private String entityType; // CLASS, INTERFACE, METHOD, ENUM, RECORD, CONSTRUCTOR
    private String className;
    private String methodName;
    private String signature;
    private String returnType;
    private String parameters;
    private Integer startLine;
    private Integer endLine;
    private String commitHash;
    private String docStatus; // UNDOCUMENTED
    private String suggestedDocTitle; // Ví dụ: "Tài liệu kỹ thuật cho lớp OrderController"
    private String suggestedTemplateType; // Ví dụ: "API_REFERENCE"
    private String aiGenerateUrl; // Đường dẫn một chạm điền sẵn query params để sinh tài liệu
    private Instant createdAt;
}
