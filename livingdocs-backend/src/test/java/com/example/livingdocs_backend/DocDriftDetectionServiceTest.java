package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DocDriftDetectionServiceTest {

        private CodeDiffAnalysisServicePort codeDiffAnalysisService;
        private SpringDataDocCodeLinkRepository docCodeLinkRepository;
        private SpringDataDocumentRepository documentRepository;
        private SpringDataDocumentChangeAlertRepository alertRepository;
        private SpringDataRepositoryRepository repositoryRepository;
        private SpringDataPullRequestRepository pullRequestRepository;
        private SpringDataGitHubConnectionRepository connectionRepository;
        private GitHubClientPort gitHubClient;
        private DocDriftDetectionService docDriftDetectionService;

        @BeforeEach
        void setUp() {
                codeDiffAnalysisService = mock(CodeDiffAnalysisServicePort.class);
                docCodeLinkRepository = mock(SpringDataDocCodeLinkRepository.class);
                documentRepository = mock(SpringDataDocumentRepository.class);
                alertRepository = mock(SpringDataDocumentChangeAlertRepository.class);
                repositoryRepository = mock(SpringDataRepositoryRepository.class);
                pullRequestRepository = mock(SpringDataPullRequestRepository.class);
                connectionRepository = mock(SpringDataGitHubConnectionRepository.class);
                gitHubClient = mock(GitHubClientPort.class);

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
}
