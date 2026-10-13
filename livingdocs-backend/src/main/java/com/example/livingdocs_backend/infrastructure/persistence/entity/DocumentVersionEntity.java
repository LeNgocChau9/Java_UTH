package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "document_versions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "version_id")
    private Long versionId;

    @Column(name = "doc_id", nullable = false)
    private Long docId;

    @Column(name = "version_num", nullable = false)
    private Integer versionNum;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "actor_role", length = 50)
    private String actorRole;

    @Column(name = "trigger_type", length = 100)
    private String triggerType;

    @Column(name = "hash", length = 256)
    private String hash;

    @Column(name = "prev_hash", length = 256)
    private String prevHash;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
