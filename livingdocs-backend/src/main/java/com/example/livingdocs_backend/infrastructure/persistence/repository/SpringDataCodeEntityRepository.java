package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataCodeEntityRepository extends JpaRepository<CodeEntityJpaEntity, Long> {

    List<CodeEntityJpaEntity> findByRepositoryId(Long repositoryId);

    List<CodeEntityJpaEntity> findByRepositoryIdAndFilePath(Long repositoryId, String filePath);

    List<CodeEntityJpaEntity> findByRepositoryIdAndDocStatus(Long repositoryId, String docStatus);

    List<CodeEntityJpaEntity> findByDocStatus(String docStatus);

    @Modifying
    @Query("DELETE FROM CodeEntityJpaEntity c WHERE c.repositoryId = :repositoryId AND c.filePath = :filePath")
    void deleteByRepositoryIdAndFilePath(@Param("repositoryId") Long repositoryId, @Param("filePath") String filePath);

    @Modifying
    @Query("DELETE FROM CodeEntityJpaEntity c WHERE c.repositoryId = :repositoryId")
    void deleteByRepositoryId(@Param("repositoryId") Long repositoryId);

    @Query("""
        SELECT c FROM CodeEntityJpaEntity c
        WHERE (:repositoryId IS NULL OR c.repositoryId = :repositoryId)
          AND (c.docStatus IS NULL OR UPPER(c.docStatus) NOT IN ('DOCUMENTED', 'DRIFTED')
               OR NOT EXISTS (
                   SELECT 1 FROM DocCodeLinkEntity d
                   WHERE (d.entityId IS NOT NULL AND d.entityId = c.entityId)
                      OR (d.filePath = c.filePath
                          AND ((c.methodName IS NOT NULL AND d.methodName = c.methodName)
                               OR (c.methodName IS NULL AND c.className IS NOT NULL AND d.className = c.className)))
               ))
        ORDER BY c.filePath ASC, c.className ASC, c.startLine ASC
    """)
    List<CodeEntityJpaEntity> findCoverageGaps(@Param("repositoryId") Long repositoryId);
}
