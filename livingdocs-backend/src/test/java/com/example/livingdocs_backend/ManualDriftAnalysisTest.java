package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisRequestDto;
import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisResponseDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.DocDriftDetectionService;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ManualDriftAnalysisTest {

    @Mock
    private CodeDiffAnalysisServicePort codeDiffAnalysisService;
    @Mock
    private SpringDataDocCodeLinkRepository docCodeLinkRepository;
    @Mock
    private SpringDataDocumentRepository documentRepository;
    @Mock
    private SpringDataDocumentVersionRepository documentVersionRepository;
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
        docDriftDetectionService = new DocDriftDetectionService(
                codeDiffAnalysisService,
                docCodeLinkRepository,
                documentRepository,
                documentVersionRepository,
                alertRepository,
                repositoryRepository,
                pullRequestRepository,
                connectionRepository,
                gitHubClient,
                (org.springframework.web.client.RestClient) null,
                "http://localhost:3000"
        );
    }

    @Test
    @DisplayName("Kích hoạt phân tích sai lệch thủ công cho một Tài liệu cụ thể (mode = DOCUMENT)")
    void shouldAnalyzeSpecificDocumentManuallyAndPersistAlert() {
        DocumentEntity doc = DocumentEntity.builder()
                .docId(15L)
                .repoId(1L)
                .title("Đặc tả API Xác thực JWT")
                .targetPath("docs/auth-jwt.md")
                .build();

        DocumentVersionEntity version = DocumentVersionEntity.builder()
                .versionId(100L)
                .docId(15L)
                .versionNum(1)
                .content("# Đặc tả API\nHàm cũ: loginUser(username)")
                .build();

        DocCodeLinkEntity link = DocCodeLinkEntity.builder()
                .linkId(1L)
                .documentId(15L)
                .filePath("src/main/java/AuthService.java")
                .className("AuthService")
                .methodName("authenticateWithMfa")
                .build();

        when(documentRepository.findById(15L)).thenReturn(Optional.of(doc));
        when(documentVersionRepository.findTopByDocIdOrderByVersionNumDesc(15L)).thenReturn(Optional.of(version));
        when(docCodeLinkRepository.findByDocumentId(15L)).thenReturn(List.of(link));
        when(alertRepository.save(any(DocumentChangeAlertEntity.class))).thenAnswer(inv -> {
            DocumentChangeAlertEntity saved = inv.getArgument(0);
            saved.setAlertId(501L);
            return saved;
        });

        ManualDriftAnalysisRequestDto req = ManualDriftAnalysisRequestDto.builder()
                .mode("DOCUMENT")
                .documentId(15L)
                .build();

        ManualDriftAnalysisResponseDto response = docDriftDetectionService.triggerManualDriftAnalysis(req);

        assertNotNull(response);
        assertEquals("DOCUMENT", response.getMode());
        assertEquals(15L, response.getDocumentId());
        assertEquals(1, response.getTotalDriftsDetected());
        assertEquals(501L, response.getAlerts().get(0).getAlertId());
        assertEquals("SIGNATURE", response.getAlerts().get(0).getClassification());
        assertEquals("OPEN", response.getAlerts().get(0).getStatus());
    }

    @Test
    @DisplayName("Kích hoạt phân tích sai lệch thủ công cho một Pull Request (mode = PULL_REQUEST)")
    void shouldAnalyzePullRequestManuallyAndPersistAlert() {
        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(1L)
                .repoName("Java_UTH")
                .repoFullName("LeNgocChau9/Java_UTH")
                .build();

        PullRequestEntity pr = PullRequestEntity.builder()
                .prId(77L)
                .repositoryId(1L)
                .prNumber(212)
                .title("feat: manual drift analysis")
                .headBranch("feature/week6-manual-drift")
                .headCommitHash("abc1234567")
                .build();

        DocumentEntity doc = DocumentEntity.builder()
                .docId(20L)
                .repoId(1L)
                .title("Tài liệu Kiến trúc Hệ thống")
                .targetPath("docs/architecture.md")
                .build();

        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repo));
        when(codeDiffAnalysisService.fetchPullRequestDiff(1L, 212)).thenThrow(new RuntimeException("Simulated offline PR diff"));
        when(pullRequestRepository.findByRepositoryIdAndPrNumber(1L, 212)).thenReturn(Optional.of(pr));
        when(documentRepository.findByRepoId(1L)).thenReturn(List.of(doc));
        when(alertRepository.save(any(DocumentChangeAlertEntity.class))).thenAnswer(inv -> {
            DocumentChangeAlertEntity saved = inv.getArgument(0);
            saved.setAlertId(602L);
            return saved;
        });

        ManualDriftAnalysisRequestDto req = ManualDriftAnalysisRequestDto.builder()
                .mode("PULL_REQUEST")
                .repositoryId(1L)
                .prNumber(212)
                .build();

        ManualDriftAnalysisResponseDto response = docDriftDetectionService.triggerManualDriftAnalysis(req);

        assertNotNull(response);
        assertEquals("PULL_REQUEST", response.getMode());
        assertEquals(212, response.getPrNumber());
        assertEquals(1, response.getTotalDriftsDetected());
        assertEquals(602L, response.getAlerts().get(0).getAlertId());
    }
}

