package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AuditLogEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class AuditLogRepositoryAdapter implements AuditLogRepositoryPort {

    private final SpringDataAuditLogRepository springDataAuditLogRepository;

    @Override
    @Transactional
    public AuditLog save(AuditLog auditLog) {
        AuditLogEntity saved = springDataAuditLogRepository.save(AuditLogEntity.builder()
                .actorId(auditLog.getActorId())
                .action(auditLog.getAction())
                .resourceType(auditLog.getResourceType())
                .resourceId(auditLog.getResourceId())
                .detail(auditLog.getDetail())
                .ipAddress(auditLog.getIpAddress())
                .build());

        return AuditLog.builder()
                .logId(saved.getLogId())
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
