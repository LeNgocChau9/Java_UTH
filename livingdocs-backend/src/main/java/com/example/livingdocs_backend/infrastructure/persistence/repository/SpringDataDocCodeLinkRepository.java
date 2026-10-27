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
}
