package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataAuditLogRepository extends JpaRepository<AuditLogEntity, Long> {
    List<AuditLogEntity> findByResourceTypeAndResourceIdOrderByCreatedAtDesc(String resourceType, String resourceId);
}
