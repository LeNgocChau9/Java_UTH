package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body cho API xuất bản tài liệu lên GitHub.
 * Người dùng phải cung cấp GitHub Personal Access Token (hoặc OAuth Token)
 * có quyền ghi vào repository đích.
 */
@Data
public class PublishToGitHubRequest {

    @NotBlank(message = "GitHub access token không được để trống")
    @Schema(description = "GitHub Personal Access Token hoặc OAuth Token có quyền ghi repo",
            example = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    private String githubToken;

    @Schema(description = "Commit message tùy chọn; mặc định được sinh tự động từ tiêu đề tài liệu",
            example = "docs: publish API reference for UserService")
    private String commitMessage;
}
