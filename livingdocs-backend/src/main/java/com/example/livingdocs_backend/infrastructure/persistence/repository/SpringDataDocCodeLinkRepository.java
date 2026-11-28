package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataDocCodeLinkRepository extends JpaRepository<DocCodeLinkEntity, Long> {

    List<DocCodeLinkEntity> findByDocumentId(Long documentId);

    List<DocCodeLinkEntity> findByFilePath(String filePath);

    @Query("""
        SELECT dcl FROM DocCodeLinkEntity dcl
        WHERE dcl.filePath = :filePath
          AND (:className IS NULL OR dcl.className = :className)
          AND (:methodName IS NULL OR dcl.methodName = :methodName)
    """)
    List<DocCodeLinkEntity> findMatchingLinks(
            @Param("filePath") String filePath,
            @Param("className") String className,
            @Param("methodName") String methodName
    );

    @Query("""
        SELECT DISTINCT dcl.documentId FROM DocCodeLinkEntity dcl
        WHERE dcl.filePath = :filePath
          AND (dcl.methodName = :methodName OR (dcl.methodName IS NULL AND dcl.className = :className))
    """)
    List<Long> findDocumentIdsByCodeEntity(
            @Param("filePath") String filePath,
            @Param("className") String className,
            @Param("methodName") String methodName
    );

    @Query("""
        SELECT dcl FROM DocCodeLinkEntity dcl
        JOIN DocumentEntity d ON d.docId = dcl.documentId
        WHERE d.repoId = :repositoryId
          AND dcl.filePath = :filePath
          AND (:className IS NULL OR dcl.className = :className)
          AND (:methodName IS NULL OR dcl.methodName = :methodName)
    """)
    List<DocCodeLinkEntity> findMatchingLinksByRepositoryId(
            @Param("repositoryId") Long repositoryId,
            @Param("filePath") String filePath,
            @Param("className") String className,
            @Param("methodName") String methodName
    );

    @Query("""
        SELECT dcl FROM DocCodeLinkEntity dcl
        JOIN DocumentEntity d ON d.docId = dcl.documentId
        WHERE d.repoId = :repositoryId
          AND dcl.filePath = :filePath
    """)
    List<DocCodeLinkEntity> findByRepositoryIdAndFilePath(
            @Param("repositoryId") Long repositoryId,
            @Param("filePath") String filePath
    );

    @Query("""
        SELECT dcl FROM DocCodeLinkEntity dcl
        JOIN DocumentEntity d ON d.docId = dcl.documentId
        WHERE d.repoId = :repositoryId
    """)
    List<DocCodeLinkEntity> findByRepositoryId(@Param("repositoryId") Long repositoryId);

    @Query("""
        SELECT dcl FROM DocCodeLinkEntity dcl
        JOIN DocumentEntity d ON d.docId = dcl.documentId
        JOIN RepositoryEntity r ON r.repositoryId = d.repoId
        WHERE r.workspaceId = :workspaceId
    """)
    List<DocCodeLinkEntity> findByWorkspaceId(@Param("workspaceId") Long workspaceId);
}
