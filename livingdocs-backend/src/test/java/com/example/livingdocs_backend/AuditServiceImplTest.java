package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.service.AuditServiceImpl;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class AuditServiceImplTest {

    private AuditLogRepositoryPort auditLogRepositoryPort;
    private AuditServiceImpl auditService;

    @BeforeEach
    void setUp() {
        auditLogRepositoryPort = mock(AuditLogRepositoryPort.class);
        auditService = new AuditServiceImpl(auditLogRepositoryPort);
    }

    @Test
    void recordsLoginAttemptsWithActorAndResult() {
        auditService.recordLogin(12L, "user@example.com", true);
        auditService.recordLogin(null, "unknown@example.com", false);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepositoryPort, times(2)).save(captor.capture());
        List<AuditLog> logs = captor.getAllValues();

        assertEquals(AuditAction.LOGIN_SUCCESS, logs.get(0).getAction());
        assertEquals(12L, logs.get(0).getActorId());
        assertEquals("USER", logs.get(0).getResourceType());
        assertEquals("12", logs.get(0).getResourceId());
        assertEquals("email=user@example.com", logs.get(0).getDetail());

        assertEquals(AuditAction.LOGIN_FAILURE, logs.get(1).getAction());
        assertNull(logs.get(1).getActorId());
        assertEquals("email=unknown@example.com", logs.get(1).getDetail());
    }

    @Test
    void recordsRoleAndDocumentActions() {
        auditService.recordRoleChange(1L, "admin@example.com", 9L, "DEVELOPER", "MANAGER");
        auditService.recordDocumentDeletion(1L, 44L);
        auditService.recordDocumentApproval(2L, 45L);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepositoryPort, times(3)).save(captor.capture());
        List<AuditLog> logs = captor.getAllValues();

        assertEquals(AuditAction.ROLE_CHANGED, logs.get(0).getAction());
        assertEquals(1L, logs.get(0).getActorId());
        assertEquals("9", logs.get(0).getResourceId());
        assertEquals("actorEmail=admin@example.com; previousRoles=DEVELOPER; newRole=MANAGER",
                logs.get(0).getDetail());

        assertEquals(AuditAction.DOCUMENT_DELETED, logs.get(1).getAction());
        assertEquals("DOCUMENT", logs.get(1).getResourceType());
        assertEquals("44", logs.get(1).getResourceId());

        assertEquals(AuditAction.DOCUMENT_APPROVED, logs.get(2).getAction());
        assertEquals(2L, logs.get(2).getActorId());
        assertEquals("45", logs.get(2).getResourceId());
    }
}
