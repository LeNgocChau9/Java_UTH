package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.CollectionRollbackRequest;
import com.example.livingdocs_backend.application.dto.CollectionRollbackResponse;
import com.example.livingdocs_backend.application.dto.RollbackResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.application.service.DocumentServiceImpl;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DocumentAndCollectionRollbackTest {

    private DocumentRepositoryPort documentRepositoryPort;
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private AuditServicePort auditServicePort;
    private ChangelogServicePort changelogServicePort;
    private DocumentServiceImpl documentService;

    @BeforeEach
    void setUp() {
        documentRepositoryPort = mock(DocumentRepositoryPort.class);
        documentVersionRepositoryPort = mock(DocumentVersionRepositoryPort.class);
        auditServicePort = mock(AuditServicePort.class);
        changelogServicePort = mock(ChangelogServicePort.class);

        documentService = new DocumentServiceImpl(
                documentRepositoryPort,
                documentVersionRepositoryPort,
                auditServicePort,
                changelogServicePort,
                null,
                null,
                null,
                null
        );
    }

    @Test
    void rollbackToVersionRestoresContentAndRecordsAuditLog() {
        Document doc = Document.builder()
                .docId(10L)
                .title("API Auth Guide")
                .currentVersion(3)
                .status(DocumentStatus.DRAFT)
                .build();

        DocumentVersion v1 = DocumentVersion.builder()
                .versionId(101L)
                .docId(10L)
                .versionNum(1)
                .content("# Nội dung phiên bản v1 an toàn")
                .actorRole(ActorRole.DEV)
                .hash("hash-v1")
                .prevHash("GENESIS")
                .build();

        DocumentVersion v3 = DocumentVersion.builder()
                .versionId(103L)
                .docId(10L)
                .versionNum(3)
                .content("# Nội dung v3 bị lỗi")
                .hash("hash-v3")
                .build();

        when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(doc));
        when(documentVersionRepositoryPort.findByDocIdAndVersionNum(10L, 1)).thenReturn(Optional.of(v1));
        when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(v3));
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(inv -> {
            DocumentVersion saved = inv.getArgument(0);
            saved.setVersionId(104L);
            return saved;
        });

        RollbackResponse response = documentService.rollbackToVersion(10L, 1, "Hoàn tác bản lỗi", 5L, "MANAGER");

        assertNotNull(response);
        assertEquals(10L, response.getDocId());
        assertEquals(1, response.getTargetVersion());
        assertEquals(4, response.getNewVersion());
        assertEquals("# Nội dung phiên bản v1 an toàn", response.getVersion().getContent());

        // Verify Audit Log recorded
        verify(auditServicePort).recordDocumentAction(
                eq(5L),
                eq(10L),
                eq(AuditAction.DOCUMENT_ROLLBACK),
                contains("Khôi phục tài liệu về phiên bản v1"));
    }

    @Test
    void rollbackByVersionIdRestoresFromSpecificHistoryEntry() {
        Document doc = Document.builder()
                .docId(20L)
                .title("System Architecture")
                .currentVersion(2)
                .build();

        DocumentVersion v1 = DocumentVersion.builder()
                .versionId(201L)
                .docId(20L)
                .versionNum(1)
                .content("# Kiến trúc hệ thống chuẩn v1")
                .hash("hash-201")
                .build();

        when(documentVersionRepositoryPort.findById(201L)).thenReturn(Optional.of(v1));
        when(documentRepositoryPort.findById(20L)).thenReturn(Optional.of(doc));
        when(documentVersionRepositoryPort.findByDocIdAndVersionNum(20L, 1)).thenReturn(Optional.of(v1));
        when(documentVersionRepositoryPort.findLatestByDocId(20L)).thenReturn(Optional.of(v1));
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(inv -> inv.getArgument(0));

        RollbackResponse response = documentService.rollbackByVersionId(20L, 201L, "Khôi phục theo versionId", 7L, "STAFF");

        assertNotNull(response);
        assertEquals(20L, response.getDocId());
        assertEquals(1, response.getTargetVersion());
        assertEquals(3, response.getNewVersion());
        assertEquals("# Kiến trúc hệ thống chuẩn v1", response.getVersion().getContent());
    }

    @Test
    void rollbackCollectionRestoresAllDocumentsAndRecordsCollectionAuditLog() {
        Document doc1 = Document.builder()
                .docId(1L)
                .collectionId(99L)
                .title("Doc 1")
                .currentVersion(2)
                .build();

        Document doc2 = Document.builder()
                .docId(2L)
                .collectionId(99L)
                .title("Doc 2")
                .currentVersion(3)
                .build();

        Document doc3OnlyV1 = Document.builder()
                .docId(3L)
                .collectionId(99L)
                .title("Doc 3 (Only v1)")
                .currentVersion(1)
                .build();

        when(documentRepositoryPort.findByCollectionId(99L)).thenReturn(List.of(doc1, doc2, doc3OnlyV1));
        when(documentRepositoryPort.findById(1L)).thenReturn(Optional.of(doc1));
        when(documentRepositoryPort.findById(2L)).thenReturn(Optional.of(doc2));

        DocumentVersion doc1V1 = DocumentVersion.builder()
                .versionId(11L)
                .docId(1L)
                .versionNum(1)
                .content("Doc 1 - v1 content")
                .hash("h1")
                .build();

        DocumentVersion doc2V2 = DocumentVersion.builder()
                .versionId(22L)
                .docId(2L)
                .versionNum(2)
                .content("Doc 2 - v2 content")
                .hash("h2")
                .build();

        when(documentVersionRepositoryPort.findByDocIdAndVersionNum(1L, 1)).thenReturn(Optional.of(doc1V1));
        when(documentVersionRepositoryPort.findLatestByDocId(1L)).thenReturn(Optional.of(doc1V1));
        when(documentVersionRepositoryPort.findByDocIdAndVersionNum(2L, 2)).thenReturn(Optional.of(doc2V2));
        when(documentVersionRepositoryPort.findLatestByDocId(2L)).thenReturn(Optional.of(doc2V2));
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(inv -> inv.getArgument(0));

        CollectionRollbackRequest request = CollectionRollbackRequest.builder()
                .stepsBack(1)
                .reason("Hoàn tác đợt cập nhật tự động bị lỗi")
                .build();

        CollectionRollbackResponse result = documentService.rollbackCollection(99L, request, 1L, "ADMIN");

        assertNotNull(result);
        assertEquals(99L, result.getCollectionId());
        assertEquals(3, result.getTotalDocuments());
        assertEquals(2, result.getRolledBackCount());
        assertEquals(1, result.getSkippedCount());
        assertEquals(2, result.getRolledBackDocuments().size());

        // Verify Audit Log recorded for individual docs and collection
        verify(auditServicePort, times(2)).recordDocumentAction(eq(1L), anyLong(), eq(AuditAction.DOCUMENT_ROLLBACK), anyString());
        verify(auditServicePort).recordSecurityAction(
                eq(1L),
                eq(AuditAction.COLLECTION_ROLLBACK),
                eq("COLLECTION"),
                eq("99"),
                contains("Hoàn tác thành công 2/3 tài liệu"));
    }
}
