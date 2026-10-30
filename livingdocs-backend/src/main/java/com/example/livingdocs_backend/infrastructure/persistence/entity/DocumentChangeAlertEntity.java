package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity lưu cảnh báo trôi dạt tài liệu phát hiện từ Pull Request hoặc đối chiếu Code AST.
 * Bảng: document_change_alerts
 */
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

    @Column(name = "document_id")
    private Long documentId;

    @Column(name = "repository_id", nullable = false)
    private Long repositoryId;

    @Column(name = "classification", nullable = false, length = 30)
    @Builder.Default
    private String classification = "SEMANTIC"; // REFERENCE, SIGNATURE, SEMANTIC

    @Column(name = "severity", nullable = false, length = 20)
    @Builder.Default
    private String severity = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "OPEN"; // OPEN, RESOLVED, IGNORED

    @Column(name = "source_commit", length = 64)
    private String sourceCommit;

    @Column(name = "source_pr_id")
    private Long sourcePrId;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "draft_version_id")
    private Long draftVersionId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
