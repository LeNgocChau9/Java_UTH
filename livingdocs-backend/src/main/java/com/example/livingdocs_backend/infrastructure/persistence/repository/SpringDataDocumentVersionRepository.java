package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataDocumentVersionRepository extends JpaRepository<DocumentVersionEntity, Long> {
    Optional<DocumentVersionEntity> findTopByDocIdOrderByVersionNumDesc(Long docId);
    Optional<DocumentVersionEntity> findByDocIdAndVersionNum(Long docId, Integer versionNum);
    List<DocumentVersionEntity> findByDocIdOrderByVersionNumDesc(Long docId);
    List<DocumentVersionEntity> findByDocIdOrderByVersionNumAsc(Long docId);
    void deleteByDocId(Long docId);
}
