package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.dto.drift.AutoDocUpdateJobPayload;
import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.worker.handler.AutoDocUpdateJobHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutoDocUpdateJobHandlerTest {

    @Mock
    private AutoDraftServicePort autoDraftService;

    @Mock
    private CodeDiffAnalysisServicePort codeDiffAnalysisService;

    @Mock
    private DocDriftDetectionServicePort docDriftDetectionService;

    @Mock
    private SpringDataDocumentRepository documentRepository;

    @Mock
    private com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository docCodeLinkRepository;

    @Mock
    private SpringDataRepositoryRepository repositoryRepository;

    @Mock
    private SpringDataGitHubConnectionRepository connectionRepository;

    @Mock
    private GitHubClientPort gitHubClient;

    private ObjectMapper objectMapper;
    private AutoDocUpdateJobHandler jobHandler;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        jobHandler = new AutoDocUpdateJobHandler(
                autoDraftService,
                codeDiffAnalysisService,
                docDriftDetectionService,
                documentRepository,
                docCodeLinkRepository,
                repositoryRepository,
                connectionRepository,
                gitHubClient,
                objectMapper
        );
    }

    @Test
    @DisplayName("AutoDocUpdateJobHandler bóc tách commit Java và tự động tạo bản nháp mới cho tài liệu với tác nhân AI_AGENT")
    void shouldExecuteAutoUpdatePipelineForJavaCommit() throws Exception {
        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(1L)
                .repoFullName("LeNgocChau9/livingdocs-backend")
                .build();

        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repo));

        AffectedDocumentResultDto affectedDoc = AffectedDocumentResultDto.builder()
                .documentId(10L)
                .documentTitle("OrderService API Reference")
                .relatedFilePath("src/main/java/com/example/OrderService.java")
                .className("OrderService")
                .methodName("processPayment")
                .changeType("PARAM_CHANGED")
                .details("Added parameter currency")
                .build();

        when(docDriftDetectionService.findAffectedDocuments(eq(1L), any()))
                .thenReturn(List.of(affectedDoc));

        AutoDraftOnDriftResponse response = AutoDraftOnDriftResponse.builder()
                .documentId(10L)
                .versionId(101L)
                .versionNum(2)
                .status("PENDING_REVIEW")
                .actorRole("AI_AGENT")
                .triggerType("AUTO_DRIFT_AI_REWRITE")
                .build();

        when(autoDraftService.generateAutoDraftForDocument(eq(10L), anyString(), eq("head-commit-123"), anyString(), isNull()))
                .thenReturn(response);

        AutoDocUpdateJobPayload payload = AutoDocUpdateJobPayload.builder()
                .repositoryId(1L)
                .repoFullName("LeNgocChau9/livingdocs-backend")
                .eventType("push")
                .headCommitSha("head-commit-123")
                .baseCommitSha("base-commit-000")
                .commitAuthor("Nguyen Developer")
                .commitMessage("feat: update OrderService payment processing")
                .changedFiles(List.of("src/main/java/com/example/OrderService.java"))
                .build();

        Job job = Job.builder()
                .jobId(55L)
                .type("AUTO_DOC_UPDATE")
                .payloadJson(objectMapper.writeValueAsString(payload))
                .build();

        jobHandler.handle(job);

        verify(docDriftDetectionService, times(1)).findAffectedDocuments(eq(1L), any());
        verify(autoDraftService, times(1)).generateAutoDraftForDocument(
                eq(10L),
                contains("processPayment"),
                eq("head-commit-123"),
                anyString(),
                isNull()
        );
    }

    @Test
    @DisplayName("AutoDocUpdateJobHandler hỗ trợ tổng quát mọi ngôn ngữ nguồn (TypeScript .tsx, Python .py, C# .cs,...) và liên kết doc_code_links")
    void shouldExecuteAutoUpdatePipelineForMultilingualSourceFiles() throws Exception {
        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(2L)
                .repoFullName("LeNgocChau9/Source_JS-TS")
                .build();

        when(repositoryRepository.findById(2L)).thenReturn(Optional.of(repo));

        com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity link = 
                com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity.builder()
                        .documentId(63L)
                        .filePath("src/components/LampLoginClient.tsx")
                        .build();

        when(docCodeLinkRepository.findByFilePath("src/components/LampLoginClient.tsx"))
                .thenReturn(List.of(link));

        AutoDocUpdateJobPayload payload = AutoDocUpdateJobPayload.builder()
                .repositoryId(2L)
                .repoFullName("LeNgocChau9/Source_JS-TS")
                .eventType("push")
                .headCommitSha("head-sha-tsx")
                .baseCommitSha("base-sha-0")
                .commitAuthor("Chau Developer")
                .commitMessage("feat: update LampLoginClient authentication flow")
                .changedFiles(List.of("src/components/LampLoginClient.tsx"))
                .diffContent("@@ -10,3 +10,4 @@\n+const useAuth = () => { return true; };")
                .build();

        Job job = Job.builder()
                .jobId(77L)
                .type("AUTO_DOC_UPDATE")
                .payloadJson(objectMapper.writeValueAsString(payload))
                .build();

        jobHandler.handle(job);

        verify(autoDraftService, times(1)).generateAutoDraftForDocument(
                eq(63L),
                contains("LampLoginClient.tsx"),
                eq("head-sha-tsx"),
                anyString(),
                isNull()
        );
    }
}

