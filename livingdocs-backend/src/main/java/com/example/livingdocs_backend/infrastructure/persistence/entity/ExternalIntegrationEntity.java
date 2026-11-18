package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * JPA Entity ánh xạ bảng public.external_integrations trong PostgreSQL.
 * Lưu trữ cấu hình tích hợp ngoài theo cặp duy nhất (provider, workspace_id):
 * SLACK, DISCORD, CUSTOM_WEBHOOK, CONFLUENCE, NOTION, JIRA...
 */
@Entity
@Table(
        name = "external_integrations",
        uniqueConstraints = {
                @UniqueConstraint(name = "external_integrations_provider_workspace_id_key", columnNames = {"provider", "workspace_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExternalIntegrationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "integration_id", nullable = false)
    private Long integrationId;

    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "workspace_id")
    @Builder.Default
    private Long workspaceId = 1L;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_json", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private String configJson = "{}";

    @Column(name = "secret_configured", nullable = false)
    @Builder.Default
    private boolean secretConfigured = false;

    @Column(name = "updated_by")
    private Long updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
