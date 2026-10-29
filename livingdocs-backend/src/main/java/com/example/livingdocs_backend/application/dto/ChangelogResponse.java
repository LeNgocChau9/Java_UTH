package com.example.livingdocs_backend.application.dto;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChangelogResponse {

    private Long id;
    private Long documentId;
    private Long versionId;
    private Long actorId;
    private String actorRole;
    private String changeSummary;
    private Instant createdAt;
}
