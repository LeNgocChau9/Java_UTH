package com.example.livingdocs_backend.application.port;

public interface AuditServicePort {
    void recordLogin(Long actorId, String actorEmail, boolean successful);

    void recordRoleChange(Long actorId, String actorEmail, Long targetUserId,
                          String previousRoles, String newRole);

    void recordDocumentDeletion(Long actorId, Long documentId);

    void recordDocumentApproval(Long actorId, Long documentId);
}
