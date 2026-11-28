package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataReviewRepository extends JpaRepository<ReviewEntity, Long> {

    List<ReviewEntity> findByDocIdOrderByCreatedAtDesc(Long docId);

    Optional<ReviewEntity> findFirstByDocIdOrderByCreatedAtDesc(Long docId);

    Optional<ReviewEntity> findFirstByDocIdAndResultOrderByCreatedAtDesc(Long docId, String result);

    List<ReviewEntity> findAllByOrderByCreatedAtDesc();

    @Query("""
        SELECT rv FROM ReviewEntity rv
        JOIN DocumentEntity d ON d.docId = rv.docId
        JOIN RepositoryEntity r ON r.repositoryId = d.repoId
        WHERE r.workspaceId = :workspaceId
        ORDER BY rv.createdAt DESC
    """)
    List<ReviewEntity> findByWorkspaceIdOrderByCreatedAtDesc(@Param("workspaceId") Long workspaceId);
}
