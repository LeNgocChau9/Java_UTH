package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportExternalDocRequest {

    @NotNull(message = "repoId không được để trống")
    @Schema(description = "ID kho lưu trữ GitHub liên kết", example = "1")
    private Long repoId;

    @NotBlank(message = "Tiêu đề tài liệu không được để trống")
    @Schema(description = "Tiêu đề tài liệu", example = "Tài liệu Yêu cầu Nghiệp vụ từ Confluence")
    private String title;

    @Schema(description = "Đường dẫn file đích trong repository", example = "docs/confluence-requirements.md")
    private String targetPath;

    @NotBlank(message = "sourceType không được để trống (GOOGLE_DOCS, CONFLUENCE, JIRA, MARKDOWN, DOCX)")
    @Schema(description = "Nguồn tài liệu (GOOGLE_DOCS, CONFLUENCE, JIRA, MARKDOWN, DOCX)", example = "CONFLUENCE")
    private String sourceType;

    @Schema(description = "URL hoặc ID gốc trên nền tảng (Doc ID, Confluence Page URL, Jira Issue Key)", example = "https://wiki.company.com/pages/viewpage.action?pageId=123456")
    private String sourceUrlOrId;

    @Schema(description = "Nội dung Markdown hoặc văn bản thô trích xuất từ nền tảng ngoài")
    private String content;

    @Schema(description = "ID mẫu tài liệu (tùy chọn)", example = "1")
    private Long templateId;
}

