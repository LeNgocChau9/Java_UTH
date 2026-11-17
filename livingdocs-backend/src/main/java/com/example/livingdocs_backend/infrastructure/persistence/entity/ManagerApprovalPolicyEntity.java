package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "manager_approval_policies", uniqueConstraints = {
        @UniqueConstraint(name = "uk_manager_policy_workspace_type", columnNames = {"workspace_id", "document_type"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagerApprovalPolicyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id")
    private Long policyId;

    @Column(name = "workspace_id", nullable = false)
    @Builder.Default
    private Long workspaceId = 1L;

    @Column(name = "document_type", nullable = false, length = 100)
    private String documentType;

    @Column(name = "approval_required", nullable = false)
    @Builder.Default
    private Boolean approvalRequired = true;

    @Column(name = "merge_policy", nullable = false, length = 20)
    @Builder.Default
    private String mergePolicy = "WARN";

    @Column(name = "tiers", nullable = false)
    @Builder.Default
    private Integer tiers = 2;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_by_email", length = 255)
    private String updatedByEmail;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.workspaceId == null) {
            this.workspaceId = 1L;
        }
        if (this.approvalRequired == null) {
            this.approvalRequired = (this.tiers == null || this.tiers > 1);
        }
        if (this.mergePolicy == null) {
            this.mergePolicy = "WARN";
        }
        if (this.tiers == null) {
            this.tiers = Boolean.TRUE.equals(this.approvalRequired) ? 2 : 1;
        }
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.updatedAt == null) {
            this.updatedAt = Instant.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
        if (this.tiers != null) {
            this.approvalRequired = (this.tiers > 1);
        }
    }
}
