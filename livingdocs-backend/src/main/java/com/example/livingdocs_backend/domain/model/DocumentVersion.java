package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentVersion {
    private Long versionId;
    private Long docId;
    private Integer versionNum;
    private String content;
    private ActorRole actorRole;
    private String triggerType;
    private String hash;
    private String prevHash;
    private Instant createdAt;

    /** SHA của commit khi xuất bản tài liệu lên GitHub. Null nếu chưa publish. */
    private String commitHash;

    /** URL HTML đến commit trên GitHub. Null nếu chưa publish. */
    private String commitUrl;

    /** Thời điểm xuất bản thành công. Null nếu chưa publish. */
    private LocalDateTime publishedAt;
}
