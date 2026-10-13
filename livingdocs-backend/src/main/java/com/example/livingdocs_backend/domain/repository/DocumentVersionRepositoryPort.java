package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.DocumentVersion;

import java.util.List;
import java.util.Optional;

public interface DocumentVersionRepositoryPort {
    DocumentVersion save(DocumentVersion version);
    Optional<DocumentVersion> findLatestByDocId(Long docId);
    Optional<DocumentVersion> findByDocIdAndVersionNum(Long docId, Integer versionNum);
    List<DocumentVersion> findAllByDocIdOrderByVersionNumDesc(Long docId);
    List<DocumentVersion> findAllByDocIdOrderByVersionNumAsc(Long docId);
    void deleteAllByDocId(Long docId);
}
