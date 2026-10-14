package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * JPA Entity ánh xạ trực tiếp tới bảng `code_entities` trong PostgreSQL.
 */
@Entity
@Table(name = "code_entities")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodeEntityJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "entity_id")
    private Long entityId;

    @Column(name = "repository_id", nullable = false)
    private Long repositoryId;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "entity_type", nullable = false, length = 50)
    private String entityType;

    @Column(name = "class_name", length = 255)
    private String className;

    @Column(name = "method_name", length = 255)
    private String methodName;

    @Column(name = "signature", columnDefinition = "TEXT")
    private String signature;

    @Column(name = "return_type", length = 150)
    private String returnType;

    @Column(name = "parameters", columnDefinition = "TEXT")
    private String parameters;

    @Column(name = "start_line")
    private Integer startLine;

    @Column(name = "end_line")
    private Integer endLine;

    @Column(name = "commit_hash", nullable = false, length = 64)
    private String commitHash;

    @Column(name = "doc_status", nullable = false, length = 50)
    @Builder.Default
    private String docStatus = "UNDOCUMENTED";

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
