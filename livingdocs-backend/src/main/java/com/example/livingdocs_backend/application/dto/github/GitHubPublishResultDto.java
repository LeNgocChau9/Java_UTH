package com.example.livingdocs_backend.application.dto.github;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO lưu kết quả sau khi gọi GitHub Contents API (PUT) thành công.
 * Chứa SHA commit và HTML URL để lưu vào bảng document_versions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubPublishResultDto {

    /** SHA của commit vừa được tạo trên GitHub. */
    private String commitSha;

    /** URL HTML trực tiếp đến commit trên GitHub. */
    private String commitUrl;

    /** Đường dẫn file trong repository. */
    private String filePath;
}
