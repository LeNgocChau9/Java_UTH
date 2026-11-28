package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.Review;

import java.util.List;
import java.util.Optional;

public interface ReviewRepositoryPort {

    Review save(Review review);

    Optional<Review> findById(Long reviewId);

    List<Review> findByDocId(Long docId);

    Optional<Review> findLatestByDocId(Long docId);

    Optional<Review> findFirstByDocIdAndResultOrderByCreatedAtDesc(Long docId, String result);

    List<Review> findAll();

    default List<Review> findByWorkspaceId(Long workspaceId) {
        return List.of();
    }
}
