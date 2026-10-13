package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.AuditLog;

public interface AuditLogRepositoryPort {
    AuditLog save(AuditLog auditLog);
}
