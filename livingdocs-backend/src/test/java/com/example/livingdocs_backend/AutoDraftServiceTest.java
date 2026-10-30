package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.application.service.AutoDraftServiceImpl;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutoDraftServiceTest {

    @Mock
    private SpringDataDocumentChangeAlertRepository alertRepository;

    @Mock
    private SpringDataDocumentRepository documentRepository;

    @Mock
    private SpringDataDocumentVersionRepository documentVersionRepository;

    @Mock
    private AuditServicePort auditServicePort;

    @Mock
    private ChangelogServicePort changelogServicePort;

    @Mock
    private RestClient restClient;

    private AutoDraftServicePort autoDraftService;

    private UserPrincipal testActor;
    private DocumentChangeAlertEntity testAlert;
    private DocumentEntity testDoc;
    private DocumentVersionEntity testVersion1;

    @BeforeEach
    void setUp() {
        autoDraftService = new AutoDraftServiceImpl(
                alertRepository,
                documentRepository,
                documentVersionRepository,
                auditServicePort,
                changelogServicePort,
                restClient
        );

        testActor = new UserPrincipal(1L, "admin@example.com", Collections.singleton("ROLE_ADMIN"));

        testDoc = DocumentEntity.builder()
                .docId(10L)
                .title("OrderService API Reference")
                .status(DocumentStatus.PUBLISHED)
                .currentVersion(1)
                .repoId(1L)
                .build();

        testVersion1 = DocumentVersionEntity.builder()
                .versionId(100L)
                .docId(10L)
                .versionNum(1)
                .content("# OrderService API\n## processPayment(Long id, Double amount)")
                .hash("hash1")
                .prevHash("0000000000000000000000000000000000000000000000000000000000000000")
                .actorRole("DEV")
                .createdAt(Instant.now())
                .build();

        testAlert = DocumentChangeAlertEntity.builder()
                .alertId(50L)
                .documentId(10L)
                .repositoryId(1L)
                .status("OPEN")
                .severity("HIGH")
                .classification("SIGNATURE")
                .sourceCommit("head-sha-123")
                .details("- processPayment(Long id, Double amount)\n+ processPayment(Long id, Double amount, String currency)")
                .build();
    }

    @Test
    @DisplayName("Tự động sinh bản nháp DRAFT cho cảnh báo drift thành công")
    void generateDraftFromAlert_success() {
        when(alertRepository.findById(50L)).thenReturn(Optional.of(testAlert));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(testDoc));
        when(documentVersionRepository.findTopByDocIdOrderByVersionNumDesc(10L)).thenReturn(Optional.of(testVersion1));

        DocumentVersionEntity savedDraftVersion = DocumentVersionEntity.builder()
                .versionId(101L)
                .docId(10L)
                .versionNum(2)
                .content("# OrderService API\n## processPayment(Long id, Double amount, String currency)")
                .hash("hash2")
                .prevHash("hash1")
                .actorRole("AI")
                .triggerType("AUTO_DRIFT_AI_REWRITE")
                .createdAt(Instant.now())
                .build();

        when(documentVersionRepository.save(any(DocumentVersionEntity.class))).thenReturn(savedDraftVersion);

        AutoDraftOnDriftResponse response = autoDraftService.generateDraftFromAlert(50L, testActor);

        assertNotNull(response);
        assertEquals(50L, response.getAlertId());
        assertEquals(10L, response.getDocumentId());
        assertEquals(101L, response.getVersionId());
        assertEquals(2, response.getVersionNum());
        assertEquals("DRAFT", response.getStatus());
        assertEquals("AI", response.getActorRole());

        // Kiểm tra alert được cập nhật liên kết draftVersionId
        verify(alertRepository).save(argThat(a -> a.getDraftVersionId().equals(101L)));

        // Kiểm tra changelog được ghi nhận
        verify(changelogServicePort).logChange(eq(10L), eq(101L), eq(1L), eq("AI"), anyString());
    }

    @Test
    @DisplayName("Chấp nhận bản nháp DRAFT chỉ trong 1 click chuyển sang APPROVED")
    void acceptDraft_success() {
        testAlert.setDraftVersionId(101L);

        DocumentVersionEntity draftVersion = DocumentVersionEntity.builder()
                .versionId(101L)
                .docId(10L)
                .versionNum(2)
                .actorRole("AI")
                .build();

        when(alertRepository.findById(50L)).thenReturn(Optional.of(testAlert));
        when(documentVersionRepository.findById(101L)).thenReturn(Optional.of(draftVersion));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(testDoc));

        AutoDraftOnDriftResponse response = autoDraftService.acceptDraft(50L, testActor);

        assertNotNull(response);
        assertEquals(50L, response.getAlertId());
        assertEquals("APPROVED", response.getStatus());
        assertEquals(101L, response.getVersionId());

        // Kiểm tra alert được chuyển sang RESOLVED
        assertEquals("RESOLVED", testAlert.getStatus());
        assertNotNull(testAlert.getResolvedAt());
        verify(alertRepository).save(testAlert);

        // Kiểm tra doc chuyển sang APPROVED
        assertEquals(DocumentStatus.APPROVED, testDoc.getStatus());
        verify(documentRepository).save(testDoc);
    }
}

