package com.example.livingdocs_backend.application.dto;

/**
 * Task tuần 7: Request body cho API xuất bản tài liệu lên GitHub.
 */
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Request body cho API xuất bản tài liệu lên GitHub.
 * Người dùng phải cung cấp GitHub Personal Access Token (hoặc OAuth Token)
 * có quyền ghi vào repository đích.
 */
@Data
public class PublishToGitHubRequest {

    // ponytail: Cho phép githubToken trống hoặc null để chạy chế độ simulated/mock export mà không bắt buộc token thật
    @Schema(description = "GitHub Personal Access Token hoặc OAuth Token có quyền ghi repo (tùy chọn trong chế độ mock)",
            example = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    private String githubToken;

    @Schema(description = "Commit message tùy chọn; mặc định được sinh tự động từ tiêu đề tài liệu",
            example = "docs: publish API reference for UserService")
    private String commitMessage;
}
