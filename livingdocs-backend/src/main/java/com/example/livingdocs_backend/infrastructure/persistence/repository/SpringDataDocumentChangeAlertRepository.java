package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataDocumentChangeAlertRepository extends JpaRepository<DocumentChangeAlertEntity, Long> {
    List<DocumentChangeAlertEntity> findByRepositoryId(Long repositoryId);
    List<DocumentChangeAlertEntity> findByRepositoryIdAndStatus(Long repositoryId, String status);
    List<DocumentChangeAlertEntity> findBySourcePrId(Long sourcePrId);
    long countByStatusIgnoreCase(String status);
    long countByStatusInIgnoreCase(List<String> statuses);
    List<DocumentChangeAlertEntity> findByStatusIgnoreCase(String status);
    List<DocumentChangeAlertEntity> findByStatusInIgnoreCase(List<String> statuses);
    List<DocumentChangeAlertEntity> findTop10ByStatusInIgnoreCaseOrderByCreatedAtDesc(List<String> statuses);
    List<DocumentChangeAlertEntity> findTop10ByOrderByCreatedAtDesc();

    @Query(value = """
        SELECT a.* FROM document_change_alerts a
        JOIN repositories r ON r.repository_id = a.repository_id
        WHERE r.workspace_id = :workspaceId
        ORDER BY a.created_at DESC
    """, nativeQuery = true)
    List<DocumentChangeAlertEntity> findByWorkspaceId(@Param("workspaceId") Long workspaceId);

    @Query(value = """
        SELECT a.* FROM document_change_alerts a
        JOIN repositories r ON r.repository_id = a.repository_id
        WHERE r.workspace_id = :workspaceId
          AND UPPER(a.status) = UPPER(:status)
        ORDER BY a.created_at DESC
    """, nativeQuery = true)
    List<DocumentChangeAlertEntity> findByWorkspaceIdAndStatusIgnoreCase(
            @Param("workspaceId") Long workspaceId,
            @Param("status") String status);

    @Query(value = """
        SELECT COUNT(*) FROM document_change_alerts a
        JOIN repositories r ON r.repository_id = a.repository_id
        WHERE r.workspace_id = :workspaceId
          AND UPPER(a.status) IN (:statuses)
    """, nativeQuery = true)
    long countByWorkspaceIdAndStatusInIgnoreCase(
            @Param("workspaceId") Long workspaceId,
            @Param("statuses") List<String> statuses);

    @Query(value = """
        SELECT a.* FROM document_change_alerts a
        JOIN repositories r ON r.repository_id = a.repository_id
        WHERE r.workspace_id = :workspaceId
          AND UPPER(a.status) IN (:statuses)
        ORDER BY a.created_at DESC
        LIMIT 10
    """, nativeQuery = true)
    List<DocumentChangeAlertEntity> findTop10ByWorkspaceIdAndStatusInIgnoreCaseOrderByCreatedAtDesc(
            @Param("workspaceId") Long workspaceId,
            @Param("statuses") List<String> statuses);
}
