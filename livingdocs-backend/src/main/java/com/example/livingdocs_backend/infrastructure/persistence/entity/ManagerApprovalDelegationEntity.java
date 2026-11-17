package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "manager_approval_delegations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagerApprovalDelegationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "delegation_id")
    private Long delegationId;

    @Column(name = "workspace_id", nullable = false)
    @Builder.Default
    private Long workspaceId = 1L;

    @Column(name = "delegator_id")
    private Long delegatorId;

    @Column(name = "delegate_id")
    private Long delegateId;

    @Column(name = "delegator_name", length = 150)
    private String delegatorName;

    @Column(name = "delegator_email", length = 255)
    private String delegatorEmail;

    @Column(name = "delegatee_name", length = 150)
    private String delegateeName;

    @Column(name = "delegatee_email", length = 255)
    private String delegateeEmail;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        if (this.workspaceId == null) {
            this.workspaceId = 1L;
        }
        if (this.active == null) {
            this.active = true;
        }
        if (this.startsAt == null) {
            this.startsAt = Instant.now();
        }
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }
}
