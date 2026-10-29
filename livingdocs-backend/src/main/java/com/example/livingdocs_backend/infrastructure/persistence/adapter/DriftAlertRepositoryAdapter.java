package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.application.port.DriftAlertRepositoryPort;
import com.example.livingdocs_backend.domain.model.DriftAlert;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DriftAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.JpaDriftAlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DriftAlertRepositoryAdapter implements DriftAlertRepositoryPort {

    private final JpaDriftAlertRepository jpaDriftAlertRepository;

    @Override
    public DriftAlert save(DriftAlert alert) {
        DriftAlertEntity entity = toEntity(alert);
        return toDomain(jpaDriftAlertRepository.save(entity));
    }

    @Override
    public List<DriftAlert> saveAll(List<DriftAlert> alerts) {
        List<DriftAlertEntity> entities = alerts.stream().map(this::toEntity).toList();
        return jpaDriftAlertRepository.saveAll(entities).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<DriftAlert> findById(Long alertId) {
        return jpaDriftAlertRepository.findById(alertId).map(this::toDomain);
    }

    @Override
    public List<DriftAlert> findByRepoId(Long repoId) {
        return jpaDriftAlertRepository.findByRepoId(repoId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<DriftAlert> findByRepoIdAndPrNumber(Long repoId, Integer prNumber) {
        return jpaDriftAlertRepository.findByRepoIdAndPrNumber(repoId, prNumber).stream().map(this::toDomain).toList();
    }

    @Override
    public List<DriftAlert> findByStatus(String status) {
        return jpaDriftAlertRepository.findByStatus(status).stream().map(this::toDomain).toList();
    }

    private DriftAlertEntity toEntity(DriftAlert d) {
        return DriftAlertEntity.builder()
                .alertId(d.getAlertId())
                .repoId(d.getRepoId())
                .prNumber(d.getPrNumber())
                .filePath(d.getFilePath())
                .severity(d.getSeverity() != null ? d.getSeverity() : "MEDIUM")
                .diffSnippet(d.getDiffSnippet())
                .status(d.getStatus() != null ? d.getStatus() : "OPEN")
                .documentId(d.getDocumentId())
                .methodName(d.getMethodName())
                .changeType(d.getChangeType())
                .createdAt(d.getCreatedAt())
                .resolvedAt(d.getResolvedAt())
                .build();
    }

    private DriftAlert toDomain(DriftAlertEntity e) {
        return DriftAlert.builder()
                .alertId(e.getAlertId())
                .repoId(e.getRepoId())
                .prNumber(e.getPrNumber())
                .filePath(e.getFilePath())
                .severity(e.getSeverity())
                .diffSnippet(e.getDiffSnippet())
                .status(e.getStatus())
                .documentId(e.getDocumentId())
                .methodName(e.getMethodName())
                .changeType(e.getChangeType())
                .createdAt(e.getCreatedAt())
                .resolvedAt(e.getResolvedAt())
                .build();
    }
}
