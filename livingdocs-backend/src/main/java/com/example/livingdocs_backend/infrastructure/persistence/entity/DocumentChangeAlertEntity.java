package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "document_change_alerts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentChangeAlertEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "repository_id", nullable = false)
    private Long repositoryId;

    @Column(name = "classification", nullable = false, length = 30)
    @Builder.Default
    private String classification = "SEMANTIC";

    @Column(name = "severity", nullable = false, length = 20)
    @Builder.Default
    private String severity = "MEDIUM";

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "source_commit", length = 64)
    private String sourceCommit;

    @Column(name = "source_pr_id")
    private Long sourcePrId;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
