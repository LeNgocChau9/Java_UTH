package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewCommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataReviewCommentRepository extends JpaRepository<ReviewCommentEntity, Long> {
}
