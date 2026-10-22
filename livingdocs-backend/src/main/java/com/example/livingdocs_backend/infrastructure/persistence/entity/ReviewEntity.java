package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "doc_id")
    private Long docId;

    @Column(name = "version_id")
    private Long versionId;

    @Column(name = "reviewer", nullable = false, length = 100)
    private String reviewer;

    @Column(name = "general_comment", columnDefinition = "TEXT")
    private String generalComment;

    @Column(name = "result", length = 50)
    @Builder.Default
    private String result = "PENDING";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
