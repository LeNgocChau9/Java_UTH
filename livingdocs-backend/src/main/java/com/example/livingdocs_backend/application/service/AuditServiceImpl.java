package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditServicePort {

    private final AuditLogRepositoryPort auditLogRepositoryPort;

    @Override
    public void recordLogin(Long actorId, String actorEmail, boolean successful) {
        AuditAction action = successful ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILURE;
        record(actorId, action, "USER", actorId != null ? actorId.toString() : null,
                "email=" + actorEmail);
    }

    @Override
    public void recordRoleChange(Long actorId, String actorEmail, Long targetUserId,
                                 String previousRoles, String newRole) {
        record(actorId, AuditAction.ROLE_CHANGED, "USER", targetUserId.toString(),
                "actorEmail=" + actorEmail + "; previousRoles=" + previousRoles + "; newRole=" + newRole);
    }

    @Override
    public void recordDocumentDeletion(Long actorId, Long documentId) {
        record(actorId, AuditAction.DOCUMENT_DELETED, "DOCUMENT", documentId.toString(), null);
    }

    @Override
    public void recordDocumentApproval(Long actorId, Long documentId) {
        record(actorId, AuditAction.DOCUMENT_APPROVED, "DOCUMENT", documentId.toString(), null);
    }

    @Override
    public void recordDocumentAction(Long actorId, Long documentId, AuditAction action, String detail) {
        record(actorId, action, "DOCUMENT", documentId.toString(), detail);
    }

    @Override
    public void recordSecurityAction(Long actorId, AuditAction action, String resourceType, String resourceId, String detail) {
        record(actorId, action, resourceType, resourceId, detail);
    }

    @Override
    public java.util.List<AuditLog> getAuditLogsForResource(String resourceType, String resourceId) {
        return auditLogRepositoryPort.findByResourceTypeAndResourceId(resourceType, resourceId);
    }

    @Override
    public List<AuditLog> search(String action, Instant from, Instant to) {
        String wanted = action == null ? "" : action.trim().toUpperCase();
        return auditLogRepositoryPort.findRecent().stream()
                .filter(log -> wanted.isEmpty() || (log.getAction() != null && log.getAction().name().equals(wanted)))
                .filter(log -> from == null || (log.getCreatedAt() != null && !log.getCreatedAt().isBefore(from)))
                .filter(log -> to == null || (log.getCreatedAt() != null && !log.getCreatedAt().isAfter(to)))
                .toList();
    }

    private void record(Long actorId, AuditAction action, String resourceType,
                        String resourceId, String detail) {
        auditLogRepositoryPort.save(AuditLog.builder()
                .actorId(actorId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .detail(detail)
                .build());
    }
}
