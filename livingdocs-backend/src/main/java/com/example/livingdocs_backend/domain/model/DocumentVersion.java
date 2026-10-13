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
}
