package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity ánh xạ bảng document_change_policies:
 * Cấu hình quy tắc thay đổi mã nguồn theo pattern thư mục, ngưỡng số lượng thay đổi (threshold),
 * và bật/tắt tự động cập nhật tài liệu (auto_update_enabled).
 */
@Entity
@Table(name = "document_change_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentChangePolicyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id")
    private Long policyId;

    @Column(name = "workspace_id", nullable = false)
    @Builder.Default
    private Long workspaceId = 1L;

    @Column(name = "repository_id")
    private Long repositoryId;

    @Column(name = "module_pattern", length = 500)
    private String modulePattern;

    @Column(name = "document_type", length = 100)
    private String documentType;

    @Column(name = "threshold", nullable = false)
    @Builder.Default
    private Integer threshold = 1;

    @Column(name = "auto_update_enabled", nullable = false)
    @Builder.Default
    private Boolean autoUpdateEnabled = false;

    @Column(name = "updated_by")
    private Long updatedBy;

    @CreationTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
