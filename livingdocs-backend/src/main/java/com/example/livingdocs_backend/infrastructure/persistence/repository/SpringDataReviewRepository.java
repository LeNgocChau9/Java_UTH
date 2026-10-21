package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataReviewRepository extends JpaRepository<ReviewEntity, Long> {

    List<ReviewEntity> findByDocIdOrderByCreatedAtDesc(Long docId);

    Optional<ReviewEntity> findFirstByDocIdOrderByCreatedAtDesc(Long docId);
}
