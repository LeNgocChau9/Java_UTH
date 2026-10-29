package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.Changelog;
import com.example.livingdocs_backend.domain.repository.ChangelogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ChangelogEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataChangelogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ChangelogRepositoryAdapter implements ChangelogRepositoryPort {

    private final SpringDataChangelogRepository springDataChangelogRepository;

    @Override
    @Transactional
    public Changelog save(Changelog changelog) {
        ChangelogEntity entity = ChangelogEntity.builder()
                .documentId(changelog.getDocumentId())
                .versionId(changelog.getVersionId())
                .actorId(changelog.getActorId())
                .actorRole(changelog.getActorRole())
                .changeSummary(changelog.getChangeSummary())
                .build();

        ChangelogEntity saved = springDataChangelogRepository.save(entity);

        return toDomain(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Changelog> findByDocumentId(Long documentId) {
        return springDataChangelogRepository.findByDocumentIdOrderByCreatedAtDesc(documentId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Changelog> findAll(Long documentId, String actorRole) {
        String roleParam = (actorRole != null && !actorRole.isBlank()) ? actorRole.trim() : null;
        return springDataChangelogRepository.findFiltered(documentId, roleParam)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private Changelog toDomain(ChangelogEntity entity) {
        return Changelog.builder()
                .id(entity.getId())
                .documentId(entity.getDocumentId())
                .versionId(entity.getVersionId())
                .actorId(entity.getActorId())
                .actorRole(entity.getActorRole())
                .changeSummary(entity.getChangeSummary())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
