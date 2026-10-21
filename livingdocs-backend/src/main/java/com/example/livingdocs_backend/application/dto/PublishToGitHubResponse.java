package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response trả về sau khi xuất bản tài liệu lên GitHub thành công.
 * Chứa SHA commit và URL link trực tiếp đến commit trên GitHub.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishToGitHubResponse {

    @Schema(description = "ID tài liệu", example = "42")
    private Long docId;

    @Schema(description = "Tiêu đề tài liệu")
    private String title;

    @Schema(description = "Đường dẫn file tài liệu trong repo", example = "docs/api/UserService.md")
    private String githubPath;

    @Schema(description = "SHA của commit vừa tạo trên GitHub", example = "a1b2c3d4e5f6...")
    private String commitHash;

    @Schema(description = "URL HTML trực tiếp đến commit trên GitHub",
            example = "https://github.com/owner/repo/commit/a1b2c3d4e5f6")
    private String commitUrl;

    @Schema(description = "Số phiên bản tài liệu đã được xuất bản", example = "3")
    private Integer publishedVersion;

    @Schema(description = "Thời điểm xuất bản thành công")
    private LocalDateTime publishedAt;

    @Schema(description = "Thông điệp trạng thái", example = "Tài liệu đã được xuất bản thành công lên GitHub")
    private String message;
}
