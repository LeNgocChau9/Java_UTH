package com.example.livingdocs_backend.domain.model;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class AuditLog {
    private Long logId;
    private Long actorId;
    private AuditAction action;
    private String resourceType;
    private String resourceId;
    private String detail;
    private String ipAddress;
    private Instant createdAt;
}
