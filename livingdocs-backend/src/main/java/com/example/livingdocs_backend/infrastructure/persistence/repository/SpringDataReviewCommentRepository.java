package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewCommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataReviewCommentRepository extends JpaRepository<ReviewCommentEntity, Long> {

    List<ReviewCommentEntity> findByDocIdOrderByCreatedAtAsc(Long docId);

    List<ReviewCommentEntity> findByDocIdAndStatusOrderByCreatedAtAsc(Long docId, String status);

    List<ReviewCommentEntity> findByReviewIdOrderByCreatedAtAsc(Long reviewId);
}
