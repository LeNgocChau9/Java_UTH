package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ChangelogResponse;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.domain.model.Changelog;
import com.example.livingdocs_backend.domain.repository.ChangelogRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChangelogServiceImpl implements ChangelogServicePort {

    private final ChangelogRepositoryPort changelogRepositoryPort;

    @Override
    @Transactional
    public Changelog logChange(Long documentId, Long versionId, Long actorId, String actorRole, String changeSummary) {
        if (documentId == null) {
            log.warn("Không thể ghi nhận changelog vì documentId là null");
            return null;
        }

        String role = (actorRole != null && !actorRole.isBlank()) ? actorRole.trim().toUpperCase() : "DEV";
        String summary = (changeSummary != null && !changeSummary.isBlank()) ? changeSummary.trim() : "Cập nhật tài liệu";

        Changelog changelog = Changelog.builder()
                .documentId(documentId)
                .versionId(versionId)
                .actorId(actorId)
                .actorRole(role)
                .changeSummary(summary)
                .createdAt(Instant.now())
                .build();

        Changelog saved = changelogRepositoryPort.save(changelog);
        log.info("Đã ghi nhận changelog ID: {} cho Document ID: {}, Version ID: {}, Actor: {} ({}) - Nội dung: {}",
                saved.getId(), documentId, versionId, actorId, role, summary);
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChangelogResponse> getChangelogsByDocument(Long documentId) {
        return changelogRepositoryPort.findByDocumentId(documentId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChangelogResponse> getChangelogs(Long documentId, String actorRole) {
        return changelogRepositoryPort.findAll(documentId, actorRole)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private ChangelogResponse toResponse(Changelog c) {
        return ChangelogResponse.builder()
                .id(c.getId())
                .documentId(c.getDocumentId())
                .versionId(c.getVersionId())
                .actorId(c.getActorId())
                .actorRole(c.getActorRole())
                .changeSummary(c.getChangeSummary())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
