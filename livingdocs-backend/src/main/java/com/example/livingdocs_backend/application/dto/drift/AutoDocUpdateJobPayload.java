package com.example.livingdocs_backend.application.dto.drift;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payload chứa thông tin kích hoạt tự động cập nhật tài liệu (Auto-Update Pipeline)
 * khi mã nguồn được commit/push hoặc merge Pull Request trên GitHub.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutoDocUpdateJobPayload {
    private Long repositoryId;
    private String repoFullName;
    private String eventType;
    private String headCommitSha;
    private String baseCommitSha;
    private String commitAuthor;
    private String commitMessage;
    private List<String> changedFiles;
    private String diffContent;
}

