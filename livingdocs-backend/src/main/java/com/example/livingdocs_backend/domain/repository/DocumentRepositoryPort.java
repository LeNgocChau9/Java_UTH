package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.Document;

import java.util.List;
import java.util.Optional;

public interface DocumentRepositoryPort {
    Document save(Document document);
    Optional<Document> findById(Long docId);
    List<Document> findAll();
    List<Document> findByRepoId(Long repoId);
    List<Document> findByCollectionId(Long collectionId);
    List<Document> findByRepoIdAndCollectionId(Long repoId, Long collectionId);
    List<Document> findByStatus(com.example.livingdocs_backend.domain.model.DocumentStatus status);
    default List<Document> findByWorkspaceId(Long workspaceId) {
        return List.of();
    }
    default List<Document> findByStatusAndWorkspaceId(
            com.example.livingdocs_backend.domain.model.DocumentStatus status,
            Long workspaceId) {
        return List.of();
    }
    boolean existsById(Long docId);
    void deleteById(Long docId);
}
