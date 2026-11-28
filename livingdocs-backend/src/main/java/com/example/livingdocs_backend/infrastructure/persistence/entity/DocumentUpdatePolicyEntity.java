package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity ánh xạ bảng document_update_policies:
 * Cấu hình quy tắc kích hoạt cập nhật tài liệu theo sự kiện (Commit, Pull Request, Merge)
 * và hành động thực thi (AUTO_UPDATE vs REVIEW).
 */
@Entity
@Table(name = "document_update_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentUpdatePolicyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id")
    private Long policyId;

    @Column(name = "workspace_id", nullable = false)
    @Builder.Default
    private Long workspaceId = 1L;

    @Column(name = "document_type", nullable = false, length = 100)
    private String documentType;

    @Column(name = "trigger_commit", nullable = false)
    @Builder.Default
    private Boolean triggerCommit = true;

    @Column(name = "trigger_pull_request", nullable = false)
    @Builder.Default
    private Boolean triggerPullRequest = true;

    @Column(name = "trigger_merge", nullable = false)
    @Builder.Default
    private Boolean triggerMerge = true;

    @Column(name = "action", nullable = false, length = 40)
    @Builder.Default
    private String action = "REVIEW"; // AUTO_UPDATE vs REVIEW

    @Column(name = "updated_by")
    private Long updatedBy;

    @CreationTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
