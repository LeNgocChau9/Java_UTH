package com.example.livingdocs_backend.infrastructure.persistence.entity;

import com.example.livingdocs_backend.domain.model.DocumentStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "doc_id")
    private Long docId;

    @Column(name = "collection_id")
    private Long collectionId;

    @Column(name = "repo_id", nullable = false)
    private Long repoId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "target_path", length = 500)
    private String targetPath;

    @Column(name = "template_id")
    private Long templateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 50)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.DRAFT;

    @Column(name = "current_version")
    @Builder.Default
    private Integer currentVersion = 1;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
