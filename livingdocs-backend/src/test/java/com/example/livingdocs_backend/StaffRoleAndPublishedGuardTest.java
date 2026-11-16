package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.UpdateDocumentRequest;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.DocumentServiceImpl;
import com.example.livingdocs_backend.application.service.TemplateStructureCheck;
import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StaffRoleAndPublishedGuardTest {

    private DocumentRepositoryPort documentRepositoryPort;
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private AuditServicePort auditServicePort;
    private ChangelogServicePort changelogServicePort;
    private SpringDataRepositoryRepository repositoryRepository;
    private SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private GitHubClientPort gitHubClient;
    private TemplateStructureCheck templateStructureCheck;
    private DocumentServiceImpl documentService;

    @BeforeEach
    void setUp() {
        documentRepositoryPort = mock(DocumentRepositoryPort.class);
        documentVersionRepositoryPort = mock(DocumentVersionRepositoryPort.class);
        auditServicePort = mock(AuditServicePort.class);
        changelogServicePort = mock(ChangelogServicePort.class);
        repositoryRepository = mock(SpringDataRepositoryRepository.class);
        gitHubConnectionRepository = mock(SpringDataGitHubConnectionRepository.class);
        gitHubClient = mock(GitHubClientPort.class);
        templateStructureCheck = mock(TemplateStructureCheck.class);

        documentService = new DocumentServiceImpl(
                documentRepositoryPort,
                documentVersionRepositoryPort,
                auditServicePort,
                changelogServicePort,
                repositoryRepository,
                gitHubConnectionRepository,
                gitHubClient,
                templateStructureCheck
        );
    }

    @Test
    @DisplayName("TECH_LEAD có quyền thực hiện duyệt cấp 1 (LEVEL_1_REVIEWERS) trong DocumentStateMachine")
    void testTechLeadIsAllowedLevel1Reviewer() {
        assertTrue(DocumentStateMachine.LEVEL_1_REVIEWERS.contains("TECH_LEAD"));
        assertTrue(DocumentStateMachine.LEVEL_1_REVIEWERS.contains("STAFF"));

        DocumentStatus next = DocumentStateMachine.transition(
                DocumentStatus.UNDER_REVIEW_STAFF,
                DocumentStatus.UNDER_REVIEW_MANAGER,
                "TECH_LEAD"
        );
        assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, next);

        DocumentStatus rejected = DocumentStateMachine.transition(
                DocumentStatus.UNDER_REVIEW_STAFF,
                DocumentStatus.REJECTED,
                "ROLE_TECH_LEAD"
        );
        assertEquals(DocumentStatus.REJECTED, rejected);
    }

    @Test
    @DisplayName("Chặn PUT /api/documents/{docId} không cho ghi đè tài liệu đã PUBLISHED")
    void testUpdateDocument_blocksOverwritingPublishedDocument() {
        Long docId = 50L;
        Document publishedDoc = Document.builder()
                .docId(docId)
                .title("Official API Spec")
                .status(DocumentStatus.PUBLISHED)
                .currentVersion(3)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(publishedDoc));

        UpdateDocumentRequest request = UpdateDocumentRequest.builder()
                .title("Hacked Title")
                .content("Overwritten content")
                .build();

        assertThrows(InvalidDocumentStatusTransitionException.class,
                () -> documentService.updateDocument(docId, request, 10L, "DEVELOPER"));

        verify(documentRepositoryPort, never()).save(any());
        verify(documentVersionRepositoryPort, never()).save(any());
    }

    @Test
    @DisplayName("Chặn PUT /api/documents/{docId} không cho tự ý đổi raw status")
    void testUpdateDocument_blocksArbitraryRawStatusChange() {
        Long docId = 51L;
        Document draftDoc = Document.builder()
                .docId(docId)
                .title("Draft Spec")
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(draftDoc));

        UpdateDocumentRequest request = UpdateDocumentRequest.builder()
                .title("Bypass Review")
                .status(DocumentStatus.PUBLISHED)
                .content("Bypassed content")
                .build();

        assertThrows(InvalidDocumentStatusTransitionException.class,
                () -> documentService.updateDocument(docId, request, 10L, "DEVELOPER"));

        verify(documentRepositoryPort, never()).save(any());
    }

    @Test
    @DisplayName("Chặn DELETE /api/documents/{docId} không cho xóa tài liệu đã PUBLISHED")
    void testDeleteDocument_blocksDeletingPublishedDocument() {
        Long docId = 52L;
        Document publishedDoc = Document.builder()
                .docId(docId)
                .title("Official Architecture")
                .status(DocumentStatus.PUBLISHED)
                .currentVersion(2)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(publishedDoc));

        assertThrows(InvalidDocumentStatusTransitionException.class,
                () -> documentService.deleteDocument(docId, 10L));

        verify(documentRepositoryPort, never()).deleteById(anyLong());
        verify(documentVersionRepositoryPort, never()).deleteAllByDocId(anyLong());
    }
}
