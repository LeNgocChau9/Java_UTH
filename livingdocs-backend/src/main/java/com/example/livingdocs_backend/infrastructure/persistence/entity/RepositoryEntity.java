package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "repositories", uniqueConstraints = {
        @UniqueConstraint(name = "uk_repo_workspace_github_id", columnNames = {"workspace_id", "github_repo_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RepositoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "repository_id")
    private Long repositoryId;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "connection_id", nullable = false)
    private Long connectionId;

    @Column(name = "github_repo_id", nullable = false)
    private Long githubRepoId;

    @Column(name = "repo_name", nullable = false, length = 150)
    private String repoName;

    @Column(name = "repo_full_name", nullable = false, length = 255)
    private String repoFullName;

    @Column(name = "default_branch", nullable = false, length = 100)
    @Builder.Default
    private String defaultBranch = "main";

    @Column(name = "clone_url", length = 500)
    private String cloneUrl;

    @Column(name = "webhook_id")
    private Long webhookId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "auto_doc_enabled", nullable = false)
    @Builder.Default
    private Boolean autoDocEnabled = true;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
