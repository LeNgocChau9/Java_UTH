package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DocumentRepositoryAdapter implements DocumentRepositoryPort {

    private final SpringDataDocumentRepository springDataDocumentRepository;

    @Override
    public Document save(Document document) {
        DocumentEntity entity = toEntity(document);
        DocumentEntity saved = springDataDocumentRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<Document> findById(Long docId) {
        return springDataDocumentRepository.findById(docId).map(this::toDomain);
    }

    @Override
    public List<Document> findAll() {
        return springDataDocumentRepository.findAll()
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Document> findByRepoId(Long repoId) {
        return springDataDocumentRepository.findByRepoId(repoId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Document> findByCollectionId(Long collectionId) {
        return springDataDocumentRepository.findByCollectionId(collectionId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Document> findByRepoIdAndCollectionId(Long repoId, Long collectionId) {
        return springDataDocumentRepository.findByRepoIdAndCollectionId(repoId, collectionId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Document> findByStatus(com.example.livingdocs_backend.domain.model.DocumentStatus status) {
        return springDataDocumentRepository.findByStatus(status)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public boolean existsById(Long docId) {
        return springDataDocumentRepository.existsById(docId);
    }

    @Override
    public void deleteById(Long docId) {
        springDataDocumentRepository.deleteById(docId);
    }

    private DocumentEntity toEntity(Document domain) {
        return DocumentEntity.builder()
                .docId(domain.getDocId())
                .collectionId(domain.getCollectionId())
                .repoId(domain.getRepoId())
                .title(domain.getTitle())
                .targetPath(domain.getTargetPath())
                .status(domain.getStatus())
                .currentVersion(domain.getCurrentVersion() != null ? domain.getCurrentVersion() : 1)
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    private Document toDomain(DocumentEntity entity) {
        return Document.builder()
                .docId(entity.getDocId())
                .collectionId(entity.getCollectionId())
                .repoId(entity.getRepoId())
                .title(entity.getTitle())
                .targetPath(entity.getTargetPath())
                .status(entity.getStatus())
                .currentVersion(entity.getCurrentVersion())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
