package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataDocumentRepository extends JpaRepository<DocumentEntity, Long> {
    List<DocumentEntity> findAllByOrderByUpdatedAtDesc();
    List<DocumentEntity> findByRepoIdOrderByUpdatedAtDesc(Long repoId);
    List<DocumentEntity> findByCollectionIdOrderByUpdatedAtDesc(Long collectionId);
    List<DocumentEntity> findByRepoIdAndCollectionIdOrderByUpdatedAtDesc(Long repoId, Long collectionId);
    List<DocumentEntity> findByRepoId(Long repoId);
    List<DocumentEntity> findByCollectionId(Long collectionId);
    List<DocumentEntity> findByRepoIdAndCollectionId(Long repoId, Long collectionId);
    List<DocumentEntity> findByStatus(com.example.livingdocs_backend.domain.model.DocumentStatus status);

    @Query("""
        SELECT d FROM DocumentEntity d
        JOIN RepositoryEntity r ON r.repositoryId = d.repoId
        WHERE r.workspaceId = :workspaceId
        ORDER BY d.updatedAt DESC
    """)
    List<DocumentEntity> findByWorkspaceId(@Param("workspaceId") Long workspaceId);

    @Query("""
        SELECT d FROM DocumentEntity d
        JOIN RepositoryEntity r ON r.repositoryId = d.repoId
        WHERE d.status = :status AND r.workspaceId = :workspaceId
        ORDER BY d.updatedAt DESC
    """)
    List<DocumentEntity> findByStatusAndWorkspaceId(
            @Param("status") com.example.livingdocs_backend.domain.model.DocumentStatus status,
            @Param("workspaceId") Long workspaceId);
}
