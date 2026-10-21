package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DocumentVersionRepositoryAdapter implements DocumentVersionRepositoryPort {

    private final SpringDataDocumentVersionRepository springDataDocumentVersionRepository;

    @Override
    public DocumentVersion save(DocumentVersion version) {
        DocumentVersionEntity entity = toEntity(version);
        DocumentVersionEntity saved = springDataDocumentVersionRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<DocumentVersion> findLatestByDocId(Long docId) {
        return springDataDocumentVersionRepository.findTopByDocIdOrderByVersionNumDesc(docId)
                .map(this::toDomain);
    }

    @Override
    public Optional<DocumentVersion> findByDocIdAndVersionNum(Long docId, Integer versionNum) {
        return springDataDocumentVersionRepository.findByDocIdAndVersionNum(docId, versionNum)
                .map(this::toDomain);
    }

    @Override
    public List<DocumentVersion> findAllByDocIdOrderByVersionNumDesc(Long docId) {
        return springDataDocumentVersionRepository.findByDocIdOrderByVersionNumDesc(docId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<DocumentVersion> findAllByDocIdOrderByVersionNumAsc(Long docId) {
        return springDataDocumentVersionRepository.findByDocIdOrderByVersionNumAsc(docId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteAllByDocId(Long docId) {
        springDataDocumentVersionRepository.deleteByDocId(docId);
    }

    private DocumentVersionEntity toEntity(DocumentVersion domain) {
        return DocumentVersionEntity.builder()
                .versionId(domain.getVersionId())
                .docId(domain.getDocId())
                .versionNum(domain.getVersionNum())
                .content(domain.getContent())
                .actorRole(domain.getActorRole() != null ? domain.getActorRole().name() : "DEV")
                .triggerType(domain.getTriggerType())
                .hash(domain.getHash())
                .prevHash(domain.getPrevHash())
                .createdAt(domain.getCreatedAt())
                .commitHash(domain.getCommitHash())
                .commitUrl(domain.getCommitUrl())
                .publishedAt(domain.getPublishedAt())
                .build();
    }

    private DocumentVersion toDomain(DocumentVersionEntity entity) {
        return DocumentVersion.builder()
                .versionId(entity.getVersionId())
                .docId(entity.getDocId())
                .versionNum(entity.getVersionNum())
                .content(entity.getContent())
                .actorRole(ActorRole.fromString(entity.getActorRole()))
                .triggerType(entity.getTriggerType())
                .hash(entity.getHash())
                .prevHash(entity.getPrevHash())
                .createdAt(entity.getCreatedAt())
                .commitHash(entity.getCommitHash())
                .commitUrl(entity.getCommitUrl())
                .publishedAt(entity.getPublishedAt())
                .build();
    }
}
