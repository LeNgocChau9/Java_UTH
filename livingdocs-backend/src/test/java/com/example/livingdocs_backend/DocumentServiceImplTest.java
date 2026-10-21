package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.example.livingdocs_backend.application.dto.CreateDocumentRequest;
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
import com.example.livingdocs_backend.application.dto.PublishToGitHubRequest;
import com.example.livingdocs_backend.application.dto.PublishToGitHubResponse;
import com.example.livingdocs_backend.application.dto.github.GitHubPublishResultDto;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
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
        private SpringDataRepositoryRepository repositoryRepository;
        private SpringDataGitHubConnectionRepository gitHubConnectionRepository;
        private GitHubClientPort gitHubClient;
        private DocumentServiceImpl documentService;

        @BeforeEach
        void setUp() {
                documentRepositoryPort = mock(DocumentRepositoryPort.class);
                documentVersionRepositoryPort = mock(DocumentVersionRepositoryPort.class);
                auditServicePort = mock(AuditServicePort.class);
                repositoryRepository = mock(SpringDataRepositoryRepository.class);
                gitHubConnectionRepository = mock(SpringDataGitHubConnectionRepository.class);
                gitHubClient = mock(GitHubClientPort.class);
                documentService = new DocumentServiceImpl(
                                documentRepositoryPort,
                                documentVersionRepositoryPort,
                                auditServicePort,
                                repositoryRepository,
                                gitHubConnectionRepository,
                                gitHubClient);
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

                verify(auditServicePort).recordDocumentAction(
                                eq(1L), eq(100L),
                                eq(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_CREATED),
                                contains("Khởi tạo tài liệu v1"));
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
                                HashUtils.GENESIS_HASH, 1, "# V1 Content", "DEV", "MANUAL_CREATE");
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

                verify(auditServicePort).recordDocumentAction(
                                eq(2L), eq(docId),
                                eq(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_UPDATED),
                                contains("Cập nhật tài liệu lên phiên bản v2"));
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

                when(documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(docId))
                                .thenReturn(List.of(v1, v2));

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

                // Giả lập hacker sửa content trong DB thành "Nội dung bị sửa trộm" mà không cập
                // nhật hash
                DocumentVersion tamperedV1 = DocumentVersion.builder()
                                .docId(docId)
                                .versionNum(1)
                                .content("Nội dung bị sửa trộm!")
                                .actorRole(ActorRole.DEV)
                                .triggerType("MANUAL")
                                .prevHash(HashUtils.GENESIS_HASH)
                                .hash(v1Hash)
                                .build();

                when(documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(docId))
                                .thenReturn(List.of(tamperedV1));

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

        @Test
        void testRollbackToVersion_createsNewVersionWithTargetContentAndChainedHash() {
                Long docId = 200L;
                Document doc = Document.builder()
                                .docId(docId)
                                .currentVersion(3)
                                .title("Doc Architecture")
                                .status(DocumentStatus.DRAFT)
                                .build();

                String targetV1Content = "# Initial Stable Content V1";
                DocumentVersion targetV1 = DocumentVersion.builder()
                                .versionId(1L)
                                .docId(docId)
                                .versionNum(1)
                                .content(targetV1Content)
                                .actorRole(ActorRole.DEV)
                                .triggerType("MANUAL_CREATE")
                                .prevHash(HashUtils.GENESIS_HASH)
                                .hash("hash_v1_1111111111111111111111111111111111111111111111111111111111111111")
                                .build();

                DocumentVersion latestV3 = DocumentVersion.builder()
                                .versionId(3L)
                                .docId(docId)
                                .versionNum(3)
                                .content("# Broken Content V3")
                                .actorRole(ActorRole.DEV)
                                .triggerType("MANUAL_UPDATE")
                                .prevHash("hash_v2_2222222222222222222222222222222222222222222222222222222222222222")
                                .hash("hash_v3_3333333333333333333333333333333333333333333333333333333333333333")
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
                when(documentVersionRepositoryPort.findByDocIdAndVersionNum(docId, 1))
                                .thenReturn(Optional.of(targetV1));
                when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(latestV3));
                when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(i -> i.getArgument(0));
                when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));

                com.example.livingdocs_backend.application.dto.RollbackResponse response = documentService
                                .rollbackToVersion(docId, 1, "Phát hiện lỗi ở v3, rollback về v1", 99L, "MANAGER");

                assertNotNull(response);
                assertEquals(docId, response.getDocId());
                assertEquals(1, response.getTargetVersion());
                assertEquals(4, response.getNewVersion());
                assertTrue(response.getMessage().contains("Đã khôi phục thành công"));

                ArgumentCaptor<DocumentVersion> versionCaptor = ArgumentCaptor.forClass(DocumentVersion.class);
                verify(documentVersionRepositoryPort).save(versionCaptor.capture());
                DocumentVersion savedV4 = versionCaptor.getValue();

                assertEquals(4, savedV4.getVersionNum());
                assertEquals(targetV1Content, savedV4.getContent(), "Nội dung v4 phải sao chép từ v1");
                assertEquals("hash_v3_3333333333333333333333333333333333333333333333333333333333333333",
                                savedV4.getPrevHash(), "prevHash của v4 phải nối tiếp hash của v3");
                assertEquals("ROLLBACK_TO_V1", savedV4.getTriggerType());
                assertEquals(ActorRole.MANAGER, savedV4.getActorRole());

                // Kiểm tra document cha được cập nhật currentVersion lên 4
                ArgumentCaptor<Document> docCaptor = ArgumentCaptor.forClass(Document.class);
                verify(documentRepositoryPort).save(docCaptor.capture());
                assertEquals(4, docCaptor.getValue().getCurrentVersion());

                verify(auditServicePort).recordDocumentAction(
                                eq(99L), eq(docId),
                                eq(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_ROLLBACK),
                                contains("Khôi phục tài liệu về phiên bản v1"));
        }

        @Test
        void testUpdateDocument_statusChange_createsNewVersionAndAudits() {
                Long docId = 105L;
                Document existingDoc = Document.builder()
                                .docId(docId)
                                .repoId(10L)
                                .title("Tài liệu đặc tả hệ thống")
                                .currentVersion(1)
                                .status(DocumentStatus.DRAFT)
                                .build();

                DocumentVersion v1 = DocumentVersion.builder()
                                .versionId(10L)
                                .docId(docId)
                                .versionNum(1)
                                .content("# Nội dung đặc tả gốc")
                                .actorRole(ActorRole.DEV)
                                .triggerType("MANUAL_CREATE")
                                .hash("hash_v1_xyz")
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(existingDoc));
                when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(v1));
                when(documentVersionRepositoryPort.save(any(DocumentVersion.class))).thenAnswer(i -> i.getArgument(0));
                when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));

                UpdateDocumentRequest updateRequest = UpdateDocumentRequest.builder()
                                .status(DocumentStatus.UNDER_REVIEW_STAFF)
                                .actorRole("DEV")
                                .triggerType("STATUS_UPDATE")
                                .build();

                DocumentResponse response = documentService.updateDocument(docId, updateRequest, 15L, "DEV");

                assertNotNull(response);
                assertEquals(2, response.getCurrentVersion());
                assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, response.getStatus());

                ArgumentCaptor<DocumentVersion> versionCaptor = ArgumentCaptor.forClass(DocumentVersion.class);
                verify(documentVersionRepositoryPort).save(versionCaptor.capture());
                DocumentVersion savedV2 = versionCaptor.getValue();

                assertEquals(2, savedV2.getVersionNum());
                assertEquals("# Nội dung đặc tả gốc", savedV2.getContent(),
                                "Phải kế thừa nội dung phiên bản trước khi content để trống");
                assertEquals("hash_v1_xyz", savedV2.getPrevHash());

                verify(auditServicePort).recordDocumentAction(
                                eq(15L), eq(docId),
                                eq(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_UPDATED),
                                contains("UNDER_REVIEW_STAFF"));
        }

        @Test
        void testRollbackToVersion_targetNotFound_throwsException() {
                Long docId = 200L;
                Document doc = Document.builder().docId(docId).currentVersion(2).build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
                when(documentVersionRepositoryPort.findByDocIdAndVersionNum(docId, 99)).thenReturn(Optional.empty());

                assertThrows(com.example.livingdocs_backend.domain.exception.DocumentVersionNotFoundException.class,
                                () -> documentService.rollbackToVersion(docId, 99, null, 1L, "DEV"));
        }

        @Test
        void testProcessManagerReview_approveAndPublish_triggersGitCommitAndAuditLog() {
                Long docId = 300L;
                Document doc = Document.builder()
                                .docId(docId)
                                .repoId(10L)
                                .title("Kiến trúc hệ thống")
                                .targetPath("docs/architecture.md")
                                .status(DocumentStatus.UNDER_REVIEW_MANAGER)
                                .currentVersion(2)
                                .build();

                DocumentVersion version2 = DocumentVersion.builder()
                                .versionId(20L)
                                .docId(docId)
                                .versionNum(2)
                                .content("# Architecture Guide v2")
                                .build();

                com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity repoEntity = com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity
                                .builder()
                                .repositoryId(10L)
                                .workspaceId(1L)
                                .repoFullName("org/livingdocs")
                                .defaultBranch("main")
                                .build();

                com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity connEntity = com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity
                                .builder()
                                .accessTokenEncrypted("ghp_valid_mock_token_123")
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
                when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
                when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(version2));
                when(repositoryRepository.findById(10L)).thenReturn(Optional.of(repoEntity));
                when(gitHubConnectionRepository.findFirstByWorkspaceIdOrderByCreatedAtDesc(1L))
                                .thenReturn(Optional.of(connEntity));
                when(gitHubClient.createOrUpdateFile(anyString(), anyString(), anyString(), anyString(), anyString(),
                                anyString(), anyString()))
                                .thenReturn("commit_sha_abc123");

                var request = com.example.livingdocs_backend.application.dto.ManagerReviewDecisionRequest.builder()
                                .decision("PUBLISH")
                                .comment("Đồng ý xuất bản lên GitHub")
                                .build();

                var response = documentService.processManagerReview(docId, request, 5L, "MANAGER");

                assertNotNull(response);
                assertEquals(DocumentStatus.PUBLISHED, response.getStatus());

                // Verify git push
                verify(gitHubClient).createOrUpdateFile(
                                eq("ghp_valid_mock_token_123"),
                                eq("org"),
                                eq("livingdocs"),
                                eq("docs/architecture.md"),
                                eq("# Architecture Guide v2"),
                                contains("Kiến trúc hệ thống"),
                                eq("main"));

                // Verify audit log
                verify(auditServicePort).recordDocumentAction(
                                eq(5L), eq(docId),
                                eq(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_PUBLISHED),
                                contains("commit_sha_abc123"));
        }

        @Test
        void testProcessManagerReview_returnToStaff_updatesStatusAndRecordsAudit() {
                Long docId = 301L;
                Document doc = Document.builder()
                                .docId(docId)
                                .status(DocumentStatus.UNDER_REVIEW_MANAGER)
                                .currentVersion(1)
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
                when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
                when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.empty());

                var request = com.example.livingdocs_backend.application.dto.ManagerReviewDecisionRequest.builder()
                                .decision("RETURN_STAFF")
                                .comment("Cần bổ sung thêm ví dụ API")
                                .build();

                var response = documentService.processManagerReview(docId, request, 8L, "MANAGER");

                assertNotNull(response);
                assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, response.getStatus());

                verify(auditServicePort).recordDocumentAction(
                                eq(8L), eq(docId),
                                eq(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_RETURNED_STAFF),
                                contains("Cần bổ sung thêm ví dụ API"));
        }

        @Test
        void testGetDocumentAuditLogs_returnsMappedLogs() {
                Long docId = 302L;
                when(documentRepositoryPort.existsById(docId)).thenReturn(true);
                when(auditServicePort.getAuditLogsForResource("DOCUMENT", "302")).thenReturn(List.of(
                                com.example.livingdocs_backend.domain.model.AuditLog.builder()
                                                .logId(1L)
                                                .actorId(2L)
                                                .action(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_SUBMITTED)
                                                .resourceType("DOCUMENT")
                                                .resourceId("302")
                                                .detail("Gửi duyệt")
                                                .build()));

                var logs = documentService.getDocumentAuditLogs(docId);
                assertEquals(1, logs.size());
                assertEquals(1L, logs.get(0).getLogId());
                assertEquals(com.example.livingdocs_backend.domain.model.AuditAction.DOCUMENT_SUBMITTED,
                                logs.get(0).getAction());
        }

        @Test
        void testRollbackToVersion_invalidVersionNum_throwsException() {
                assertThrows(IllegalArgumentException.class,
                                () -> documentService.rollbackToVersion(200L, 0, null, 1L, "DEV"));
                assertThrows(IllegalArgumentException.class,
                                () -> documentService.rollbackToVersion(200L, -5, null, 1L, "DEV"));
                assertThrows(IllegalArgumentException.class,
                                () -> documentService.rollbackToVersion(200L, null, null, 1L, "DEV"));
        }

        @Test
        void testPublishToGitHub_successfulPublication() {
                Long docId = 50L;
                Long repoId = 12L;
                String token = "ghp_mock_token_12345";
                String owner = "my-org";
                String repo = "my-repo";
                String filePath = "docs/api/UserService.md";

                Document doc = Document.builder()
                                .docId(docId)
                                .repoId(repoId)
                                .title("User Service API")
                                .targetPath(filePath)
                                .status(DocumentStatus.APPROVED)
                                .currentVersion(2)
                                .build();

                DocumentVersion latestVersion = DocumentVersion.builder()
                                .versionId(102L)
                                .docId(docId)
                                .versionNum(2)
                                .content("# User Service Documentation\nDetails about user api.")
                                .build();

                RepositoryEntity repository = RepositoryEntity.builder()
                                .repositoryId(repoId)
                                .repoName(repo)
                                .repoFullName(owner + "/" + repo)
                                .defaultBranch("main")
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
                when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(latestVersion));
                when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(repository));
                when(gitHubClient.getCurrentFileSha(token, owner, repo, filePath)).thenReturn("old_file_sha_123");
                when(gitHubClient.putFileContent(eq(token), eq(owner), eq(repo), eq(filePath),
                                anyString(), anyString(), eq("old_file_sha_123")))
                                .thenReturn(GitHubPublishResultDto.builder()
                                                .commitSha("commit_hash_abc123456")
                                                .commitUrl("https://github.com/my-org/my-repo/commit/commit_hash_abc123456")
                                                .filePath(filePath)
                                                .build());

                PublishToGitHubRequest request = new PublishToGitHubRequest();
                request.setGithubToken(token);
                request.setCommitMessage("docs: update User Service docs");

                PublishToGitHubResponse response = documentService.publishToGitHub(docId, request, 999L);

                assertNotNull(response);
                assertEquals(docId, response.getDocId());
                assertEquals("commit_hash_abc123456", response.getCommitHash());
                assertEquals("https://github.com/my-org/my-repo/commit/commit_hash_abc123456", response.getCommitUrl());
                assertEquals(filePath, response.getGithubPath());
                assertEquals(2, response.getPublishedVersion());

                // Xác minh trạng thái Document được cập nhật sang PUBLISHED
                ArgumentCaptor<Document> docCaptor = ArgumentCaptor.forClass(Document.class);
                verify(documentRepositoryPort).save(docCaptor.capture());
                assertEquals(DocumentStatus.PUBLISHED, docCaptor.getValue().getStatus());

                // Xác minh bảng document_versions được cập nhật commit_hash và commit_url
                ArgumentCaptor<DocumentVersion> versionCaptor = ArgumentCaptor.forClass(DocumentVersion.class);
                verify(documentVersionRepositoryPort).save(versionCaptor.capture());
                DocumentVersion updatedVersion = versionCaptor.getValue();
                assertEquals("commit_hash_abc123456", updatedVersion.getCommitHash());
                assertEquals("https://github.com/my-org/my-repo/commit/commit_hash_abc123456", updatedVersion.getCommitUrl());
                assertNotNull(updatedVersion.getPublishedAt());

                // Xác minh audit log được ghi nhận
                verify(auditServicePort).recordDocumentApproval(999L, docId);
        }

        @Test
        void testPublishToGitHub_invalidStatus_throwsException() {
                Long docId = 51L;
                Document doc = Document.builder()
                                .docId(docId)
                                .repoId(12L)
                                .status(DocumentStatus.DRAFT) // Chưa được duyệt (phải là APPROVED)
                                .currentVersion(1)
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));

                PublishToGitHubRequest request = new PublishToGitHubRequest();
                request.setGithubToken("ghp_valid_token");

                assertThrows(com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException.class,
                                () -> documentService.publishToGitHub(docId, request, 999L));
        }

        @Test
        void testPublishToGitHub_emptyToken_throwsException() {
                Long docId = 52L;
                Document doc = Document.builder()
                                .docId(docId)
                                .repoId(12L)
                                .status(DocumentStatus.APPROVED)
                                .currentVersion(1)
                                .build();

                DocumentVersion version = DocumentVersion.builder().versionId(1L).docId(docId).versionNum(1).build();
                RepositoryEntity repository = RepositoryEntity.builder()
                                .repositoryId(12L)
                                .repoFullName("owner/repo")
                                .build();

                when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
                when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(version));
                when(repositoryRepository.findById(12L)).thenReturn(Optional.of(repository));

                PublishToGitHubRequest request = new PublishToGitHubRequest();
                request.setGithubToken("");

                assertThrows(IllegalArgumentException.class,
                                () -> documentService.publishToGitHub(docId, request, 999L));
        }

}

