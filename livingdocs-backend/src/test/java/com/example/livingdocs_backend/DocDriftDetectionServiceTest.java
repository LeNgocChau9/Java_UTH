package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.DocDriftDetectionService;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;

class DocDriftDetectionServiceTest {

        @Mock
        private CodeDiffAnalysisServicePort codeDiffAnalysisService;
        @Mock
        private SpringDataDocCodeLinkRepository docCodeLinkRepository;
        @Mock
        private SpringDataDocumentRepository documentRepository;
        @Mock
        private SpringDataDocumentChangeAlertRepository alertRepository;
        @Mock
        private SpringDataRepositoryRepository repositoryRepository;
        @Mock
        private SpringDataPullRequestRepository pullRequestRepository;
        @Mock
        private SpringDataGitHubConnectionRepository connectionRepository;
        @Mock
        private GitHubClientPort gitHubClient;
        private DocDriftDetectionService docDriftDetectionService;

        @BeforeEach
        void setUp() {
                MockitoAnnotations.openMocks(this);

                docDriftDetectionService = new DocDriftDetectionService(
                                codeDiffAnalysisService,
                                docCodeLinkRepository,
                                documentRepository,
                                alertRepository,
                                repositoryRepository,
                                pullRequestRepository,
                                connectionRepository,
                                gitHubClient);
        }

        @Test
        @DisplayName("Kiểm thử tìm tài liệu bị ảnh hưởng qua doc_code_links và tự động comment lên PR")
        void testDetectDriftAndCommentOnPr() {
                Long repoId = 1L;
                int prNumber = 42;

                RepositoryEntity repo = RepositoryEntity.builder()
                                .repositoryId(repoId)
                                .repoFullName("owner/test-repo")
                                .connectionId(10L)
                                .build();
                when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(repo));

                GitHubConnectionEntity connection = GitHubConnectionEntity.builder()
                                .connectionId(10L)
                                .accessTokenEncrypted("mock-github-token-secret")
                                .build();
                when(connectionRepository.findById(10L)).thenReturn(Optional.of(connection));

                PullRequestEntity pr = PullRequestEntity.builder()
                                .prId(500L)
                                .prNumber(prNumber)
                                .repositoryId(repoId)
                                .build();
                when(pullRequestRepository.findByRepositoryIdAndPrNumber(repoId, prNumber)).thenReturn(Optional.of(pr));

                // Mock kết quả AST Diff có 1 hàm bị đổi tham số (PARAM_CHANGED)
                AstDiffResponseDto diffResponse = AstDiffResponseDto.builder()
                                .status("success")
                                .total_files_analyzed(1)
                                .total_affected_entities(1)
                                .files(List.of(
                                                AstDiffResponseDto.FileDiffResultDto.builder()
                                                                .file_path("src/main/java/OrderService.java")
                                                                .class_name("OrderService")
                                                                .file_status("MODIFIED")
                                                                .total_affected(1)
                                                                .affected_entities(List.of(
                                                                                AstDiffResponseDto.AffectedEntityItemDto
                                                                                                .builder()
                                                                                                .entity_type("METHOD")
                                                                                                .class_name("OrderService")
                                                                                                .method_name("processOrder")
                                                                                                .change_type("PARAM_CHANGED")
                                                                                                .impact_level("HIGH")
                                                                                                .details("Thêm tham số String promoCode")
                                                                                                .build()))
                                                                .build()))
                                .build();
                when(codeDiffAnalysisService.analyzeAstDiff(any())).thenReturn(diffResponse);

                // Mock tìm thấy liên kết trong doc_code_links tới document_id = 12
                DocCodeLinkEntity link = DocCodeLinkEntity.builder()
                                .linkId(1L)
                                .documentId(12L)
                                .filePath("src/main/java/OrderService.java")
                                .className("OrderService")
                                .methodName("processOrder")
                                .build();
                when(docCodeLinkRepository.findMatchingLinks(eq("src/main/java/OrderService.java"), eq("OrderService"),
                                eq("processOrder")))
                                .thenReturn(List.of(link));

                DocumentEntity doc = DocumentEntity.builder()
                                .docId(12L)
                                .title("Order Service API Guide")
                                .targetPath("docs/order-service.md")
                                .build();
                when(documentRepository.findById(12L)).thenReturn(Optional.of(doc));

                // Mock lưu alert
                when(alertRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

                // Mock chưa có comment cũ
                when(gitHubClient.findExistingPullRequestComment(any(), any(), any(), eq(prNumber), any()))
                                .thenReturn(null);

                // Mock gọi comment GitHub
                when(gitHubClient.createPullRequestComment(any(), any(), any(), eq(prNumber), anyString()))
                                .thenReturn(9999L);

                AstDiffRequestDto requestDto = AstDiffRequestDto.builder()
                                .repository_id(repoId)
                                .pr_number(prNumber)
                                .head_commit_hash("sha-head-123")
                                .files(Collections.emptyList())
                                .build();

                PrDriftAnalysisResultDto result = docDriftDetectionService.detectDriftAndCommentOnPr(repoId, prNumber,
                                requestDto);

                assertNotNull(result);
                assertEquals(1, result.totalAffectedDocs());
                assertEquals("Order Service API Guide", result.affectedDocuments().get(0).documentTitle());
                assertEquals("HIGH", result.affectedDocuments().get(0).severity());
                assertEquals("PARAM_CHANGED", result.affectedDocuments().get(0).changeType());

                // Xác nhận alertRepository đã lưu bản ghi
                verify(alertRepository, times(1)).saveAll(any());
                // Xác nhận gitHubClient đã được gọi để post comment
                verify(gitHubClient, times(1)).createPullRequestComment(any(), eq("owner"), eq("test-repo"),
                                eq(prNumber), contains("LivingDocs — Cảnh Báo Trôi Dạt Tài Liệu"));
        }

        @Test
        @DisplayName("Quy trình tự động: Kéo Git Diff và truy vấn doc_code_links trả về AffectedDocumentResultDto đầy đủ mức độ nghiêm trọng")
        void testFindAffectedDocumentsForPullRequest() {
                Long repoId = 1L;
                int prNumber = 10;

                AstDiffRequestDto mockDiffRequest = AstDiffRequestDto.builder()
                                .repository_id(repoId)
                                .pr_number(prNumber)
                                .base_commit_hash("base_sha")
                                .head_commit_hash("head_sha")
                                .build();
                when(codeDiffAnalysisService.fetchPullRequestDiff(repoId, prNumber)).thenReturn(mockDiffRequest);

                AstDiffResponseDto diffResponse = AstDiffResponseDto.builder()
                                .status("success")
                                .total_files_analyzed(1)
                                .files(List.of(
                                                AstDiffResponseDto.FileDiffResultDto.builder()
                                                                .file_path("src/UserService.java")
                                                                .class_name("UserService")
                                                                .affected_entities(List.of(
                                                                                AstDiffResponseDto.AffectedEntityItemDto
                                                                                                .builder()
                                                                                                .method_name("deleteAccount")
                                                                                                .change_type("DELETED")
                                                                                                .details("Hàm xóa tài khoản bị xóa")
                                                                                                .build(),
                                                                                AstDiffResponseDto.AffectedEntityItemDto
                                                                                                .builder()
                                                                                                .method_name("login")
                                                                                                .change_type("PARAM_CHANGED")
                                                                                                .details("Đổi tham số đăng nhập")
                                                                                                .build(),
                                                                                AstDiffResponseDto.AffectedEntityItemDto
                                                                                                .builder()
                                                                                                .method_name("register")
                                                                                                .change_type("ADDED")
                                                                                                .details("Thêm hàm đăng ký mới")
                                                                                                .build()))
                                                                .build()))
                                .build();
                when(codeDiffAnalysisService.analyzeAstDiff(mockDiffRequest)).thenReturn(diffResponse);

                // Mock liên kết doc_code_links cho deleteAccount -> Doc 1
                DocCodeLinkEntity link1 = DocCodeLinkEntity.builder()
                                .documentId(1L)
                                .filePath("src/UserService.java")
                                .methodName("deleteAccount")
                                .build();
                when(docCodeLinkRepository.findMatchingLinks(eq("src/UserService.java"), eq("UserService"),
                                eq("deleteAccount")))
                                .thenReturn(List.of(link1));

                // Mock liên kết doc_code_links cho login -> Doc 2
                DocCodeLinkEntity link2 = DocCodeLinkEntity.builder()
                                .documentId(2L)
                                .filePath("src/UserService.java")
                                .methodName("login")
                                .build();
                when(docCodeLinkRepository.findMatchingLinks(eq("src/UserService.java"), eq("UserService"),
                                eq("login")))
                                .thenReturn(List.of(link2));

                // Mock liên kết doc_code_links cho register -> Doc 3
                DocCodeLinkEntity link3 = DocCodeLinkEntity.builder()
                                .documentId(3L)
                                .filePath("src/UserService.java")
                                .methodName("register")
                                .build();
                when(docCodeLinkRepository.findMatchingLinks(eq("src/UserService.java"), eq("UserService"),
                                eq("register")))
                                .thenReturn(List.of(link3));

                when(documentRepository.findById(1L)).thenReturn(Optional.of(DocumentEntity.builder().docId(1L)
                                .title("User API Spec").targetPath("docs/user.md").build()));
                when(documentRepository.findById(2L)).thenReturn(Optional.of(DocumentEntity.builder().docId(2L)
                                .title("Auth Flow Spec").targetPath("docs/auth.md").build()));
                when(documentRepository.findById(3L)).thenReturn(Optional.of(DocumentEntity.builder().docId(3L)
                                .title("Register Guide").targetPath("docs/reg.md").build()));

                List<AffectedDocumentResultDto> result = docDriftDetectionService
                                .findAffectedDocumentsForPullRequest(repoId, prNumber);

                assertNotNull(result);
                assertEquals(3, result.size());

                // 1. DELETED phải có mức độ nghiêm trọng là CRITICAL
                var deletedDoc = result.stream().filter(r -> "deleteAccount".equals(r.methodName())).findFirst()
                                .orElseThrow();
                assertEquals("CRITICAL", deletedDoc.severity());
                assertEquals("User API Spec", deletedDoc.documentTitle());

                // 2. PARAM_CHANGED phải có mức độ nghiêm trọng là HIGH
                var paramDoc = result.stream().filter(r -> "login".equals(r.methodName())).findFirst().orElseThrow();
                assertEquals("HIGH", paramDoc.severity());

                // 3. ADDED phải có mức độ nghiêm trọng là LOW
                var addedDoc = result.stream().filter(r -> "register".equals(r.methodName())).findFirst().orElseThrow();
                assertEquals("LOW", addedDoc.severity());
        }

        @Test
        @DisplayName("Tự động cập nhật comment cũ nếu PR được push thêm commit mới (synchronize)")
        void testDetectDriftAndSynchronizeExistingCommentOnPr() {
                Long repoId = 1L;
                int prNumber = 42;
                Long existingCommentId = 7788L;

                RepositoryEntity repo = RepositoryEntity.builder()
                                .repositoryId(repoId)
                                .repoFullName("owner/test-repo")
                                .connectionId(10L)
                                .build();
                when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(repo));

                GitHubConnectionEntity connection = GitHubConnectionEntity.builder()
                                .connectionId(10L)
                                .accessTokenEncrypted("mock-github-token-secret")
                                .build();
                when(connectionRepository.findById(10L)).thenReturn(Optional.of(connection));

                when(codeDiffAnalysisService.analyzeAstDiff(any())).thenReturn(AstDiffResponseDto.builder()
                                .status("success").files(Collections.emptyList()).build());

                // Mock tìm thấy comment cũ có chứa marker
                when(gitHubClient.findExistingPullRequestComment(any(), eq("owner"), eq("test-repo"), eq(prNumber),
                                anyString()))
                                .thenReturn(existingCommentId);
                when(gitHubClient.updatePullRequestComment(any(), eq("owner"), eq("test-repo"), eq(existingCommentId),
                                anyString()))
                                .thenReturn(existingCommentId);

                AstDiffRequestDto requestDto = AstDiffRequestDto.builder()
                                .repository_id(repoId)
                                .pr_number(prNumber)
                                .head_commit_hash("sha-new-sync-456")
                                .files(Collections.emptyList())
                                .build();

                PrDriftAnalysisResultDto result = docDriftDetectionService.detectDriftAndCommentOnPr(repoId, prNumber,
                                requestDto);

                assertNotNull(result);
                assertEquals(existingCommentId, result.commentId());

                // Xác nhận gitHubClient đã gọi UPDATE (không tạo mới duplicate)
                verify(gitHubClient, times(1)).updatePullRequestComment(any(), eq("owner"), eq("test-repo"),
                                eq(existingCommentId), contains("LivingDocs"));
                verify(gitHubClient, never()).createPullRequestComment(any(), any(), any(), anyInt(), any());
        }

        @Test
        @DisplayName("Định dạng Markdown chuyên nghiệp: Có bảng tổng hợp mức độ sai lệch, danh sách tài liệu, tên hàm và nút dẫn link")
        void testMarkdownFormatWithSummaryTableAndLinks() {
                List<AffectedDocumentResultDto> affectedDocs = List.of(
                                AffectedDocumentResultDto.builder()
                                                .documentId(101L)
                                                .documentTitle("User Service Guide")
                                                .documentPath("docs/user.md")
                                                .methodName("deleteAccount")
                                                .changeType("DELETED")
                                                .severity("CRITICAL")
                                                .details("Hàm deleteAccount bị xóa")
                                                .build(),
                                AffectedDocumentResultDto.builder()
                                                .documentId(102L)
                                                .documentTitle("Auth Spec")
                                                .documentPath("docs/auth.md")
                                                .methodName("login")
                                                .changeType("PARAM_CHANGED")
                                                .severity("HIGH")
                                                .details("Thay đổi chữ ký tham số")
                                                .build());

                AstDiffRequestDto requestDto = AstDiffRequestDto.builder()
                                .repository_id(1L)
                                .pr_number(5)
                                .head_commit_hash("head_abc_123")
                                .build();

                String markdown = docDriftDetectionService.generateDriftCommentMarkdown(5, affectedDocs, requestDto);

                assertNotNull(markdown);
                assertTrue(markdown.contains("<!-- livingdocs-drift-alert -->"), "Phải chứa marker ẩn định danh bot");
                assertTrue(markdown.contains("Bảng tổng hợp mức độ sai lệch"), "Phải có bảng tổng hợp mức độ");
                assertTrue(markdown.contains("CRITICAL"), "Bảng phải hiển thị CRITICAL");
                assertTrue(markdown.contains("HIGH"), "Bảng phải hiển thị HIGH");
                assertTrue(markdown.contains("deleteAccount"), "Phải hiển thị tên hàm deleteAccount");
                assertTrue(markdown.contains("login"), "Phải hiển thị tên hàm login");
                assertTrue(markdown.contains("http://localhost:3000/documents/101"),
                                "Phải có link dẫn đến tài liệu trên web");
                assertTrue(markdown.contains("LivingDocs Web App"), "Phải có nút/badge mở Web App");
        }
}
