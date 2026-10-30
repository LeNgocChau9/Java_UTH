package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DriftAlertActionRequest;
import com.example.livingdocs_backend.application.dto.DriftAlertResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.DriftAlertService;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DriftAlertServiceTest {

    private SpringDataDocumentChangeAlertRepository alertRepository;
    private AuditServicePort auditServicePort;
    private DriftAlertService service;

    @BeforeEach
    void setUp() {
        alertRepository = mock(SpringDataDocumentChangeAlertRepository.class);
        auditServicePort = mock(AuditServicePort.class);
        service = new DriftAlertService(alertRepository, auditServicePort);
        when(alertRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("Developer không được đóng cảnh báo và không ghi audit")
    void developerCannotClose() {
        when(alertRepository.findById(1L)).thenReturn(Optional.of(openAlert(1L)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.handle(1L, request("IGNORE", null), principal(9L, "DEVELOPER")));

        assertEquals(403, ex.getStatusCode().value());
        verify(alertRepository, never()).save(any());
        verify(auditServicePort, never()).recordSecurityAction(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Manager bỏ qua cảnh báo thì status IGNORED và có audit log")
    void managerIgnoresAlert() {
        when(alertRepository.findById(4L)).thenReturn(Optional.of(openAlert(4L)));

        DriftAlertResponse response = service.handle(4L, request("DISMISS", null), principal(3L, "ROLE_MANAGER"));

        assertEquals("IGNORED", response.getStatus());
        assertNotNull(response.getResolvedAt());
        ArgumentCaptor<String> detail = ArgumentCaptor.forClass(String.class);
        verify(auditServicePort).recordSecurityAction(
                eq(3L), eq(AuditAction.DRIFT_ALERT_IGNORED), eq("DRIFT_ALERT"), eq("4"), detail.capture());
        assertEquals(true, detail.getValue().contains("documentId=5"));
        assertEquals(true, detail.getValue().contains("comment=không cần sửa"));
    }

    @Test
    @DisplayName("Tech Lead giải quyết và Admin chấp nhận sửa đổi")
    void resolveAndAccept() {
        when(alertRepository.findById(1L)).thenReturn(Optional.of(openAlert(1L)));
        when(alertRepository.findById(2L)).thenReturn(Optional.of(openAlert(2L)));

        assertEquals("RESOLVED", service.handle(1L, request("RESOLVE", null), principal(1L, "TECH_LEAD")).getStatus());
        assertEquals("ACCEPTED", service.handle(2L, request("ACCEPT", null), principal(2L, "ADMIN")).getStatus());
        verify(auditServicePort).recordSecurityAction(eq(1L), eq(AuditAction.DRIFT_ALERT_RESOLVED), eq("DRIFT_ALERT"), eq("1"), any());
        verify(auditServicePort).recordSecurityAction(eq(2L), eq(AuditAction.DRIFT_ALERT_ACCEPTED), eq("DRIFT_ALERT"), eq("2"), any());
    }

    @Test
    @DisplayName("đổi mức độ ghi previousSeverity và không đóng cảnh báo")
    void changesSeverity() {
        when(alertRepository.findById(7L)).thenReturn(Optional.of(openAlert(7L)));

        DriftAlertResponse response = service.handle(7L, request("CHANGE_SEVERITY", "high"), principal(2L, "ADMIN"));

        assertEquals("OPEN", response.getStatus());
        assertEquals("HIGH", response.getSeverity());
        assertEquals(null, response.getResolvedAt());
        verify(auditServicePort).recordSecurityAction(
                eq(2L), eq(AuditAction.DRIFT_ALERT_SEVERITY_CHANGED), eq("DRIFT_ALERT"), eq("7"), any());
    }

    @Test
    @DisplayName("thiếu severity hoặc mức độ không đổi thì 400 và không ghi audit")
    void rejectsBadSeverity() {
        when(alertRepository.findById(7L)).thenReturn(Optional.of(openAlert(7L)));

        assertThrows(IllegalArgumentException.class,
                () -> service.handle(7L, request("CHANGE_SEVERITY", null), principal(2L, "ADMIN")));
        assertThrows(IllegalArgumentException.class,
                () -> service.handle(7L, request("CHANGE_SEVERITY", "MEDIUM"), principal(2L, "ADMIN")));
        verify(auditServicePort, never()).recordSecurityAction(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("cảnh báo đã đóng không xử lý lại")
    void closedAlertConflicts() {
        DocumentChangeAlertEntity closed = openAlert(8L);
        closed.setStatus("RESOLVED");
        when(alertRepository.findById(8L)).thenReturn(Optional.of(closed));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.handle(8L, request("IGNORE", null), principal(2L, "ADMIN")));

        assertEquals(409, ex.getStatusCode().value());
        verify(auditServicePort, never()).recordSecurityAction(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("không có cảnh báo thì 404")
    void missingAlert() {
        when(alertRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.handle(99L, request("RESOLVE", null), principal(2L, "MANAGER")));

        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("chưa đăng nhập thì 401")
    void requiresActor() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.handle(1L, request("IGNORE", null), null));
        assertEquals(401, ex.getStatusCode().value());
    }

    private static DriftAlertActionRequest request(String action, String severity) {
        return DriftAlertActionRequest.builder()
                .action(action)
                .severity(severity)
                .comment("không cần sửa")
                .build();
    }

    private static UserPrincipal principal(Long id, String role) {
        return new UserPrincipal(id, "actor@livingdocs.local", List.of(role));
    }

    private static DocumentChangeAlertEntity openAlert(Long alertId) {
        return DocumentChangeAlertEntity.builder()
                .alertId(alertId)
                .documentId(5L)
                .repositoryId(1L)
                .severity("MEDIUM")
                .status("OPEN")
                .classification("SEMANTIC")
                .build();
    }
}
