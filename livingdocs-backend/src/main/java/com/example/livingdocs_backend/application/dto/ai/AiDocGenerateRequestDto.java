package com.example.livingdocs_backend.application.dto.ai;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.List;

/**
 * Request DTO điều phối sinh tài liệu AI theo 3 phạm vi (FILE, PACKAGE, REPOSITORY)
 * và gửi sang AI Engine (/v1/docs/generate) để sinh tài liệu kỹ thuật hoàn chỉnh từ AST.
 */
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiDocGenerateRequestDto(
        @JsonAlias({"repositoryId", "repoId", "repo_id"})
        Long repository_id,

        @JsonAlias({"scopeType", "scope_type"})
        String scope,

        @JsonAlias({"targetPath", "packagePath", "package_path"})
        String target_path,

        @JsonAlias({"filePath"})
        String file_path,

        String branch,

        @JsonAlias({"templateId"})
        Long template_id,

        @JsonAlias({"templateType"})
        String template_type,

        String title,

        String note,

        @JsonAlias({"className"})
        String class_name,

        @JsonAlias({"sourceCode"})
        String source_code,

        List<CodeEntityItemDto> entities,

        @JsonAlias({"saveDocument"})
        Boolean save_document
) {
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CodeEntityItemDto(
            @JsonAlias({"entityType"})
            String entity_type,
            @JsonAlias({"className"})
            String class_name,
            @JsonAlias({"methodName"})
            String method_name,
            String signature,
            @JsonAlias({"returnType"})
            String return_type,
            String parameters,
            @JsonAlias({"startLine"})
            Integer start_line,
            @JsonAlias({"endLine"})
            Integer end_line,
            @JsonAlias({"docStatus"})
            String doc_status,
            String javadoc,
            List<String> annotations
    ) {}
}
