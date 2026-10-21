package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.AuditLog;

import java.util.List;

public interface AuditServicePort {
    void recordLogin(Long actorId, String actorEmail, boolean successful);

    void recordRoleChange(Long actorId, String actorEmail, Long targetUserId,
                          String previousRoles, String newRole);

    void recordDocumentDeletion(Long actorId, Long documentId);

    void recordDocumentApproval(Long actorId, Long documentId);

    void recordDocumentAction(Long actorId, Long documentId, AuditAction action, String detail);

    void recordSecurityAction(Long actorId, AuditAction action, String resourceType, String resourceId, String detail);

    List<AuditLog> getAuditLogsForResource(String resourceType, String resourceId);
}

