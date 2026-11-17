package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "review_comments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewCommentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long commentId;

    @Column(name = "review_id", nullable = true)
    private Long reviewId;

    @Column(name = "doc_id")
    private Long docId;

    @Column(name = "text_segment", length = 255)
    private String textSegment;

    @Column(name = "detailed_comment", nullable = false, columnDefinition = "TEXT")
    private String detailedComment;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "author_email", length = 100)
    private String authorEmail;

    @Column(name = "author_role", length = 50)
    private String authorRole;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.status == null || this.status.isBlank()) {
            this.status = "OPEN";
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
    }
}
