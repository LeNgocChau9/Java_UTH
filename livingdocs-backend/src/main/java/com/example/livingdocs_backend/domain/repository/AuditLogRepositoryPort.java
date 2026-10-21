package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.AuditLog;

import java.util.List;

public interface AuditLogRepositoryPort {
    AuditLog save(AuditLog auditLog);
    List<AuditLog> findByResourceTypeAndResourceId(String resourceType, String resourceId);
}
