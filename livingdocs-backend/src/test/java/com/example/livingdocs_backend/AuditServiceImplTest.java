package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.AuditCleanupResultDto;
import com.example.livingdocs_backend.application.dto.AuditRetentionConfigDto;
import com.example.livingdocs_backend.application.service.AuditServiceImpl;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ChangelogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditServiceImplTest {

    private AuditLogRepositoryPort auditLogRepositoryPort;
    private ChangelogRepositoryPort changelogRepositoryPort;
    private SpringDataAdminSettingRepository adminSettingRepository;
    private ObjectMapper objectMapper;
    private AuditServiceImpl auditService;

    @BeforeEach
    void setUp() {
        auditLogRepositoryPort = mock(AuditLogRepositoryPort.class);
        changelogRepositoryPort = mock(ChangelogRepositoryPort.class);
        adminSettingRepository = mock(SpringDataAdminSettingRepository.class);
        objectMapper = new ObjectMapper();
        auditService = new AuditServiceImpl(
                auditLogRepositoryPort,
                changelogRepositoryPort,
                adminSettingRepository,
                objectMapper
        );
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

    @Test
    void filtersRecentLogsByActionAndTime() {
        Instant now = Instant.parse("2026-11-08T00:00:00Z");
        when(auditLogRepositoryPort.findRecent()).thenReturn(List.of(
                AuditLog.builder().action(AuditAction.GITHUB_LINKED).createdAt(now).detail("a").build(),
                AuditLog.builder().action(AuditAction.LOGIN_SUCCESS).createdAt(now.minusSeconds(3600)).detail("b").build()
        ));

        List<AuditLog> found = auditService.search("github_linked", now.minusSeconds(60), now.plusSeconds(60));

        assertEquals(1, found.size());
        assertEquals(AuditAction.GITHUB_LINKED, found.get(0).getAction());
    }

    @Test
    void cleanupExpiredLogsDeletesPastRecordsAndWritesAuditLog() {
        when(adminSettingRepository.findById("audit_retention_policy")).thenReturn(Optional.empty());
        when(changelogRepositoryPort.deleteByCreatedAtBefore(any(Instant.class))).thenReturn(15L);
        when(auditLogRepositoryPort.deleteByCreatedAtBefore(any(Instant.class))).thenReturn(42L);

        AuditCleanupResultDto result = auditService.cleanupExpiredLogs(60, 1L, "MANUAL_TEST");

        assertNotNull(result);
        assertEquals(42L, result.getAuditLogsDeleted());
        assertEquals(15L, result.getChangelogsDeleted());
        assertEquals(60, result.getRetentionDaysApplied());
        assertEquals("MANUAL_TEST", result.getTriggerMethod());

        // Verify delete calls
        verify(changelogRepositoryPort).deleteByCreatedAtBefore(any(Instant.class));
        verify(auditLogRepositoryPort).deleteByCreatedAtBefore(any(Instant.class));

        // Verify audit log record for cleanup
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepositoryPort).save(captor.capture());
        AuditLog cleanupLog = captor.getValue();
        assertEquals(AuditAction.AUDIT_LOG_CLEANUP, cleanupLog.getAction());
        assertEquals(1L, cleanupLog.getActorId());
        assertEquals("SYSTEM", cleanupLog.getResourceType());
        assertTrue(cleanupLog.getDetail().contains("42 bản ghi audit_logs"));
        assertTrue(cleanupLog.getDetail().contains("15 bản ghi changelogs"));
    }
}
