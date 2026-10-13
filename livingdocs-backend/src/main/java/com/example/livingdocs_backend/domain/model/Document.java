package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Document {
    private Long docId;
    private Long collectionId;
    private Long repoId;
    private String title;
    private String targetPath;
    @Builder.Default
    private DocumentStatus status = DocumentStatus.DRAFT;
    @Builder.Default
    private Integer currentVersion = 1;
    private Instant createdAt;
    private Instant updatedAt;
}
