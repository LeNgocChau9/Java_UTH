package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.CreateDocumentRequest;
import com.example.livingdocs_backend.application.dto.DocumentDetailResponse;
import com.example.livingdocs_backend.application.dto.DocumentResponse;
import com.example.livingdocs_backend.application.dto.IntegrityCheckResponse;
import com.example.livingdocs_backend.application.dto.UpdateDocumentRequest;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.DocumentServiceImpl;
import com.example.livingdocs_backend.domain.exception.DocumentNotFoundException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.util.HashUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DocumentServiceImplTest {

    private DocumentRepositoryPort documentRepositoryPort;
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private AuditServicePort auditServicePort;
    private DocumentServiceImpl documentService;

    @BeforeEach
    void setUp() {
        documentRepositoryPort = mock(DocumentRepositoryPort.class);
        documentVersionRepositoryPort = mock(DocumentVersionRepositoryPort.class);
        auditServicePort = mock(AuditServicePort.class);
        documentService = new DocumentServiceImpl(documentRepositoryPort, documentVersionRepositoryPort, auditServicePort);
    }

    @Test
    void testCreateDocument_generatesVersion1WithGenesisHash() {
        CreateDocumentRequest request = CreateDocumentRequest.builder()
                .repoId(10L)
                .collectionId(2L)
                .title("Tài liệu Kiến trúc")
                .targetPath("docs/arch.md")
                .content("# Khởi tạo kiến trúc")
                .actorRole("DEV")
                .triggerType("MANUAL_CREATE")
                .build();

        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(invocation -> {
            Document doc = invocation.getArgument(0);
            doc.setDocId(100L);
            return doc;
        });

        when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(invocation -> {
            DocumentVersion version = invocation.getArgument(0);
            version.setVersionId(1L);
            return version;
        });

        DocumentResponse response = documentService.createDocument(request, 1L, "DEV");

        assertNotNull(response);
        assertEquals(100L, response.getDocId());
        assertEquals(1, response.getCurrentVersion());
        assertEquals(DocumentStatus.DRAFT, response.getStatus());

        ArgumentCaptor<DocumentVersion> versionCaptor = ArgumentCaptor.forClass(DocumentVersion.class);
        verify(documentVersionRepositoryPort).save(versionCaptor.capture());
        DocumentVersion savedVersion = versionCaptor.getValue();

        assertEquals(100L, savedVersion.getDocId());
        assertEquals(1, savedVersion.getVersionNum());
        assertEquals(HashUtils.GENESIS_HASH, savedVersion.getPrevHash());
        assertNotNull(savedVersion.getHash());
        assertEquals(64, savedVersion.getHash().length()); // SHA-256 length is 64 hex characters
    }

    @Test
    void testUpdateDocument_incrementsVersionAndChainsHash() {
        Long docId = 100L;
        Document existingDoc = Document.builder()
                .docId(docId)
                .repoId(10L)
                .title("Tài liệu cũ")
                .currentVersion(1)
                .status(DocumentStatus.DRAFT)
                .build();

        String v1Hash = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 1, "# V1 Content", "DEV", "MANUAL_CREATE"
        );
        DocumentVersion v1 = DocumentVersion.builder()
                .versionId(1L)
                .docId(docId)
                .versionNum(1)
                .content("# V1 Content")
                .actorRole(ActorRole.DEV)
                .triggerType("MANUAL_CREATE")
                .prevHash(HashUtils.GENESIS_HASH)
                .hash(v1Hash)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(existingDoc));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(v1));
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(i -> i.getArgument(0));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDocumentRequest updateRequest = UpdateDocumentRequest.builder()
                .title("Tài liệu mới")
                .content("# V2 Content đã cập nhật")
                .actorRole("STAFF")
                .triggerType("MANUAL_UPDATE")
                .build();

        DocumentResponse response = documentService.updateDocument(docId, updateRequest, 2L, "STAFF");

        assertNotNull(response);
        assertEquals(2, response.getCurrentVersion());
        assertEquals("Tài liệu mới", response.getTitle());

        ArgumentCaptor<DocumentVersion> versionCaptor = ArgumentCaptor.forClass(DocumentVersion.class);
        verify(documentVersionRepositoryPort).save(versionCaptor.capture());
        DocumentVersion savedV2 = versionCaptor.getValue();

        assertEquals(2, savedV2.getVersionNum());
        assertEquals(v1Hash, savedV2.getPrevHash(), "prevHash của v2 phải khớp với hash của v1");
        assertNotEquals(v1Hash, savedV2.getHash());
    }

    @Test
    void testVerifyIntegrity_validChain_returnsValidTrue() {
        Long docId = 50L;
        when(documentRepositoryPort.existsById(docId)).thenReturn(true);

        // Tạo chuỗi 2 phiên bản hợp lệ
        String v1Content = "Nội dung 1";
        String v1Prev = HashUtils.GENESIS_HASH;
        String v1Hash = HashUtils.calculateVersionHash(v1Prev, 1, v1Content, "DEV", "MANUAL_CREATE");
        DocumentVersion v1 = DocumentVersion.builder()
                .docId(docId)
                .versionNum(1)
                .content(v1Content)
                .actorRole(ActorRole.DEV)
                .triggerType("MANUAL_CREATE")
                .prevHash(v1Prev)
                .hash(v1Hash)
                .build();

        String v2Content = "Nội dung 2";
        String v2Hash = HashUtils.calculateVersionHash(v1Hash, 2, v2Content, "DEV", "MANUAL_UPDATE");
        DocumentVersion v2 = DocumentVersion.builder()
                .docId(docId)
                .versionNum(2)
                .content(v2Content)
                .actorRole(ActorRole.DEV)
                .triggerType("MANUAL_UPDATE")
                .prevHash(v1Hash)
                .hash(v2Hash)
                .build();

        when(documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(docId)).thenReturn(List.of(v1, v2));

        IntegrityCheckResponse check = documentService.verifyIntegrity(docId);

        assertTrue(check.isValid());
        assertEquals(2, check.getTotalVersions());
        assertTrue(check.getIssues().isEmpty());
    }

    @Test
    void testVerifyIntegrity_tamperedContent_detectsTampering() {
        Long docId = 50L;
        when(documentRepositoryPort.existsById(docId)).thenReturn(true);

        String v1Content = "Nội dung ban đầu";
        String v1Hash = HashUtils.calculateVersionHash(HashUtils.GENESIS_HASH, 1, v1Content, "DEV", "MANUAL");

        // Giả lập hacker sửa content trong DB thành "Nội dung bị sửa trộm" mà không cập nhật hash
        DocumentVersion tamperedV1 = DocumentVersion.builder()
                .docId(docId)
                .versionNum(1)
                .content("Nội dung bị sửa trộm!")
                .actorRole(ActorRole.DEV)
                .triggerType("MANUAL")
                .prevHash(HashUtils.GENESIS_HASH)
                .hash(v1Hash)
                .build();

        when(documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(docId)).thenReturn(List.of(tamperedV1));

        IntegrityCheckResponse check = documentService.verifyIntegrity(docId);

        assertFalse(check.isValid());
        assertEquals(1, check.getTotalVersions());
        assertEquals(1, check.getIssues().size());
        assertTrue(check.getIssues().get(0).contains("bị chỉnh sửa trái phép"));
    }

    @Test
    void testDeleteDocument_deletesVersionsAndAudits() {
        Long docId = 70L;
        when(documentRepositoryPort.existsById(docId)).thenReturn(true);

        documentService.deleteDocument(docId, 5L);

        verify(documentVersionRepositoryPort).deleteAllByDocId(docId);
        verify(documentRepositoryPort).deleteById(docId);
        verify(auditServicePort).recordDocumentDeletion(5L, docId);
    }

    @Test
    void testGetDocumentById_notFound_throwsException() {
        when(documentRepositoryPort.findById(999L)).thenReturn(Optional.empty());

        assertThrows(DocumentNotFoundException.class, () -> documentService.getDocumentById(999L));
    }
}
