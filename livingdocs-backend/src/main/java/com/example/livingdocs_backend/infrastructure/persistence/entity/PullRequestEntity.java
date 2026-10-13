package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "pull_requests", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pr_repo_number", columnNames = {"repository_id", "pr_number"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PullRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "pr_id")
    private Long prId;

    @Column(name = "repository_id", nullable = false)
    private Long repositoryId;

    @Column(name = "github_pr_id", nullable = false)
    private Long githubPrId;

    @Column(name = "pr_number", nullable = false)
    private Integer prNumber;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "head_branch", nullable = false, length = 150)
    private String headBranch;

    @Column(name = "base_branch", nullable = false, length = 150)
    private String baseBranch;

    @Column(name = "head_commit_hash", nullable = false, length = 64)
    private String headCommitHash;

    @Column(name = "base_commit_hash", nullable = false, length = 64)
    private String baseCommitHash;

    @Column(name = "state", nullable = false, length = 50)
    @Builder.Default
    private String state = "OPEN";

    @Column(name = "author_username", length = 100)
    private String authorUsername;

    @Column(name = "github_created_at")
    private Instant githubCreatedAt;

    @Column(name = "github_updated_at")
    private Instant githubUpdatedAt;

    @Column(name = "github_closed_at")
    private Instant githubClosedAt;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
