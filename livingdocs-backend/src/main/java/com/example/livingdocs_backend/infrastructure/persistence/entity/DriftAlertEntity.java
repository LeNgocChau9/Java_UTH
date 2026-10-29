package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity ánh xạ bảng drift_alerts trong PostgreSQL.
 */
@Entity
@Table(name = "drift_alerts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DriftAlertEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "repo_id", nullable = false)
    private Long repoId;

    @Column(name = "pr_number")
    private Integer prNumber;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "severity", nullable = false, length = 50)
    @Builder.Default
    private String severity = "MEDIUM";

    @Column(name = "diff_snippet", columnDefinition = "TEXT")
    private String diffSnippet;

    @Column(name = "status", nullable = false, length = 50)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "document_id")
    private Long documentId;

    @Column(name = "method_name", length = 255)
    private String methodName;

    @Column(name = "change_type", length = 100)
    private String changeType;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}

