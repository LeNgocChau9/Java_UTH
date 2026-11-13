package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.example.livingdocs_backend.application.dto.DocumentResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.application.service.DocumentServiceImpl;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;

class DocumentKnowledgeBaseSearchTest {

    private DocumentRepositoryPort documentRepositoryPort;
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private DocumentServiceImpl documentService;

    private Document doc1;
    private Document doc2;
    private Document doc3;

    private DocumentVersion v1;
    private DocumentVersion v2;
    private DocumentVersion v3;

    @BeforeEach
    void setUp() {
        documentRepositoryPort = mock(DocumentRepositoryPort.class);
        documentVersionRepositoryPort = mock(DocumentVersionRepositoryPort.class);
        AuditServicePort auditServicePort = mock(AuditServicePort.class);
        ChangelogServicePort changelogServicePort = mock(ChangelogServicePort.class);

        documentService = new DocumentServiceImpl(
                documentRepositoryPort,
                documentVersionRepositoryPort,
                auditServicePort,
                changelogServicePort,
                null,
                null,
                null,
                null);

        doc1 = Document.builder()
                .docId(1L)
                .repoId(100L)
                .collectionId(10L)
                .title("Hướng dẫn Kiến trúc Hệ thống LivingDocs")
                .targetPath("docs/architecture.md")
                .status(DocumentStatus.PUBLISHED)
                .templateId(1L)
                .currentVersion(1)
                .build();

        v1 = DocumentVersion.builder()
                .versionId(11L)
                .docId(1L)
                .versionNum(1)
                .content("# Kiến trúc LivingDocs\nHệ thống quản lý tài liệu sống và đồng bộ Git tự động.")
                .actorRole(ActorRole.DEV)
                .hash("hash1")
                .prevHash("0000")
                .build();

        doc2 = Document.builder()
                .docId(2L)
                .repoId(100L)
                .collectionId(10L)
                .title("Tài liệu Đặc tả API RESTful")
                .targetPath("src/controllers/api-spec.md")
                .status(DocumentStatus.UNDER_REVIEW_STAFF)
                .templateId(2L)
                .currentVersion(2)
                .build();

        v2 = DocumentVersion.builder()
                .versionId(22L)
                .docId(2L)
                .versionNum(2)
                .content("# API Reference\nCác endpoint xác thực JWT và OAuth2 với GitHub.")
                .actorRole(ActorRole.DEV)
                .hash("hash2")
                .prevHash("hash1")
                .build();

        doc3 = Document.builder()
                .docId(3L)
                .repoId(200L)
                .collectionId(20L)
                .title("Bản thảo Thiết kế CSDL PostgreSQL")
                .targetPath("database/schema_v1.sql.md")
                .status(DocumentStatus.DRAFT)
                .templateId(null)
                .currentVersion(1)
                .build();

        v3 = DocumentVersion.builder()
                .versionId(33L)
                .docId(3L)
                .versionNum(1)
                .content("# Schema Database\nBảng documents, document_versions và audit_logs.")
                .actorRole(ActorRole.DEV)
                .hash("hash3")
                .prevHash("0000")
                .build();

        when(documentRepositoryPort.findAll()).thenReturn(List.of(doc1, doc2, doc3));
        when(documentRepositoryPort.findByRepoId(100L)).thenReturn(List.of(doc1, doc2));
        when(documentVersionRepositoryPort.findLatestByDocId(1L)).thenReturn(Optional.of(v1));
        when(documentVersionRepositoryPort.findLatestByDocId(2L)).thenReturn(Optional.of(v2));
        when(documentVersionRepositoryPort.findLatestByDocId(3L)).thenReturn(Optional.of(v3));
    }

    @Test
    @DisplayName("Tìm kiếm toàn văn theo từ khóa trong tiêu đề")
    void testSearchByKeywordInTitle() {
        List<DocumentResponse> results = documentService.searchDocuments(null, null, "kiến trúc", null, null);
        assertEquals(1, results.size());
        assertEquals("Hướng dẫn Kiến trúc Hệ thống LivingDocs", results.get(0).getTitle());
    }

    @Test
    @DisplayName("Tìm kiếm theo từ khóa xuất hiện trong đường dẫn tệp nguồn targetPath")
    void testSearchByKeywordInTargetPath() {
        List<DocumentResponse> results = documentService.searchDocuments(null, null, "controllers/api-spec", null, null);
        assertEquals(1, results.size());
        assertEquals(2L, results.get(0).getDocId());
    }

    @Test
    @DisplayName("Tìm kiếm toàn văn theo từ khóa trong nội dung văn bản markdown")
    void testSearchByKeywordInContent() {
        // "OAuth2" chỉ xuất hiện trong nội dung của doc2
        List<DocumentResponse> results = documentService.searchDocuments(null, null, "OAuth2", null, null);
        assertEquals(1, results.size());
        assertEquals("Tài liệu Đặc tả API RESTful", results.get(0).getTitle());
    }

    @Test
    @DisplayName("Lọc theo trạng thái phê duyệt kết hợp UNDER_REVIEW (chờ duyệt)")
    void testFilterByStatusReview() {
        List<DocumentResponse> results = documentService.searchDocuments(null, null, null, "UNDER_REVIEW", null);
        assertEquals(1, results.size());
        assertEquals(2L, results.get(0).getDocId());
        assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, results.get(0).getStatus());
    }

    @Test
    @DisplayName("Lọc theo loại mẫu tài liệu templateId")
    void testFilterByTemplateId() {
        List<DocumentResponse> results = documentService.searchDocuments(null, null, null, null, 1L);
        assertEquals(1, results.size());
        assertEquals(1L, results.get(0).getDocId());

        // Lọc tài liệu không dùng template (templateId = 0)
        List<DocumentResponse> noTemplateDocs = documentService.searchDocuments(null, null, null, null, 0L);
        assertEquals(1, noTemplateDocs.size());
        assertEquals(3L, noTemplateDocs.get(0).getDocId());
    }

    @Test
    @DisplayName("Tìm kiếm kết hợp đa tiêu chí: Repo + Trạng thái + Từ khóa")
    void testCombinedSearch() {
        List<DocumentResponse> results = documentService.searchDocuments(100L, null, "LivingDocs", "PUBLISHED", 1L);
        assertEquals(1, results.size());
        assertEquals(1L, results.get(0).getDocId());

        // Nếu sai trạng thái thì không tìm thấy
        List<DocumentResponse> emptyResults = documentService.searchDocuments(100L, null, "LivingDocs", "DRAFT", 1L);
        assertTrue(emptyResults.isEmpty());
    }
}

