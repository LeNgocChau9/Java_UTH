package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AuditLogEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AuditLogRepositoryAdapter implements AuditLogRepositoryPort {

    private final SpringDataAuditLogRepository springDataAuditLogRepository;

    @Override
    @Transactional
    public AuditLog save(AuditLog auditLog) {
        AuditLogEntity saved = springDataAuditLogRepository.save(AuditLogEntity.builder()
                .workspaceId(auditLog.getWorkspaceId())
                .actorId(auditLog.getActorId())
                .action(auditLog.getAction())
                .resourceType(auditLog.getResourceType())
                .resourceId(auditLog.getResourceId())
                .detail(auditLog.getDetail())
                .ipAddress(auditLog.getIpAddress())
                .build());

        return toDomain(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLog> findByResourceTypeAndResourceId(String resourceType, String resourceId) {
        return springDataAuditLogRepository.findByResourceTypeAndResourceIdOrderByCreatedAtDesc(resourceType, resourceId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLog> findRecent() {
        return springDataAuditLogRepository.findTop300ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLog> findRecentByWorkspaceId(Long workspaceId) {
        return springDataAuditLogRepository.findTop300ByWorkspaceIdOrderByCreatedAtDesc(workspaceId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public long deleteByCreatedAtBefore(Instant cutoff) {
        return springDataAuditLogRepository.deleteByCreatedAtBefore(cutoff);
    }

    private AuditLog toDomain(AuditLogEntity saved) {
        return AuditLog.builder()
                .logId(saved.getLogId())
                .workspaceId(saved.getWorkspaceId())
                .actorId(saved.getActorId())
                .action(saved.getAction())
                .resourceType(saved.getResourceType())
                .resourceId(saved.getResourceId())
                .detail(saved.getDetail())
                .ipAddress(saved.getIpAddress())
                .createdAt(saved.getCreatedAt())
                .build();
    }
}
