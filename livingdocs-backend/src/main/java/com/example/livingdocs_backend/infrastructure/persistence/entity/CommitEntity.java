package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "commits", uniqueConstraints = {
        @UniqueConstraint(name = "uk_commit_repo_hash", columnNames = {"repository_id", "commit_hash"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommitEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "commit_id")
    private Long commitId;

    @Column(name = "repository_id", nullable = false)
    private Long repositoryId;

    @Column(name = "commit_hash", nullable = false, length = 64)
    private String commitHash;

    @Column(name = "author_name", nullable = false, length = 150)
    private String authorName;

    @Column(name = "author_email", length = 255)
    private String authorEmail;

    @Column(name = "commit_message", nullable = false, columnDefinition = "TEXT")
    private String commitMessage;

    @Column(name = "committed_at", nullable = false)
    private Instant committedAt;

    @Column(name = "pr_id")
    private Long prId;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
