package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface SpringDataAuditLogRepository extends JpaRepository<AuditLogEntity, Long> {
    List<AuditLogEntity> findByResourceTypeAndResourceIdOrderByCreatedAtDesc(String resourceType, String resourceId);

    List<AuditLogEntity> findTop300ByOrderByCreatedAtDesc();

    @Modifying
    @Query("DELETE FROM AuditLogEntity a WHERE a.createdAt < :cutoff")
    long deleteByCreatedAtBefore(@Param("cutoff") Instant cutoff);
}
