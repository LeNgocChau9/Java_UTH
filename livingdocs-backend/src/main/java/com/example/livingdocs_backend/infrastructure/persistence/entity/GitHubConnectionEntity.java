package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "github_connections", uniqueConstraints = {
        @UniqueConstraint(name = "uk_gh_conn_workspace_user", columnNames = {"workspace_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GitHubConnectionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "connection_id")
    private Long connectionId;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "github_user_id")
    private Long githubUserId;

    @Column(name = "github_username", nullable = false, length = 100)
    private String githubUsername;

    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @Column(name = "token_scope", length = 255)
    private String tokenScope;

    @Column(name = "token_expires_at")
    private Instant tokenExpiresAt;

    @Column(name = "status", nullable = false, length = 50)
    @Builder.Default
    private String status = "CONNECTED";

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
