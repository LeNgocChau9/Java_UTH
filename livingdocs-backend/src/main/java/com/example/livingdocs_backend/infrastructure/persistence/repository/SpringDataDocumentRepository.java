package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataDocumentRepository extends JpaRepository<DocumentEntity, Long> {
    List<DocumentEntity> findByRepoId(Long repoId);
    List<DocumentEntity> findByCollectionId(Long collectionId);
    List<DocumentEntity> findByRepoIdAndCollectionId(Long repoId, Long collectionId);
    List<DocumentEntity> findByStatus(com.example.livingdocs_backend.domain.model.DocumentStatus status);
}
