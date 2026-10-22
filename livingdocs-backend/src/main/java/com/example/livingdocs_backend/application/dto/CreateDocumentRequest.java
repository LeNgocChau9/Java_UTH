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
public class CreateDocumentRequest {

    @NotNull(message = "Mã kho lưu trữ (repoId) không được để trống")
    @Schema(description = "ID của repository", example = "1")
    private Long repoId;

    @Schema(description = "ID bộ sưu tập (doc_collections)", example = "1")
    private Long collectionId;

    @NotBlank(message = "Tiêu đề tài liệu không được để trống")
    @Schema(description = "Tiêu đề tài liệu", example = "Hướng dẫn Kiến trúc Hệ thống LivingDocs")
    private String title;

    @Schema(description = "Đường dẫn file tài liệu trong kho mã", example = "docs/architecture.md")
    private String targetPath;

    @NotBlank(message = "Nội dung khởi tạo không được để trống")
    @Schema(description = "Nội dung văn bản (Markdown/Text) của phiên bản đầu tiên", example = "# Kiến trúc LivingDocs\nHệ thống gồm Backend Spring Boot và Web Next.js...")
    private String content;

    @Schema(description = "Vai trò tác nhân tạo tài liệu: AI, DEV, STAFF, MANAGER", example = "DEV")
    private String actorRole;

    @Schema(description = "Loại kích hoạt tạo phiên bản", example = "MANUAL_CREATE")
    private String triggerType;

    @Schema(description = "Template dùng để kiểm tra cấu trúc khi Staff xem xét", example = "1")
    private Long templateId;
}
