package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.application.service.GitHubWebhookServiceImpl;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCommitRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitHubWebhookAlertGenerationTest {

    @Mock
    private SpringDataRepositoryRepository repositoryRepository;
    @Mock
    private SpringDataPullRequestRepository pullRequestRepository;
    @Mock
    private SpringDataCommitRepository commitRepository;
    @Mock
    private SpringDataDocumentChangeAlertRepository alertRepository;
    @Mock
    private SpringDataDocumentRepository documentRepository;
    @Mock
    private JobQueue jobQueue;

    private ObjectMapper objectMapper;
    private GitHubWebhookServiceImpl webhookService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        webhookService = new GitHubWebhookServiceImpl(
                repositoryRepository,
                pullRequestRepository,
                commitRepository,
                alertRepository,
                documentRepository,
                objectMapper,
                jobQueue
        );
    }

    @Test
    @DisplayName("Webhook Push: Tạo DocumentChangeAlertEntity trạng thái PENDING và liên kết documentId")
    void testHandlePushEvent_GeneratesPendingAlertWithDocumentLink() {
        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(10L)
                .githubRepoId(99999L)
                .repoFullName("acme/my-service")
                .build();

        when(repositoryRepository.findAll()).thenReturn(List.of(repo));
        when(alertRepository.findByRepositoryId(10L)).thenReturn(Collections.emptyList());

        DocumentEntity doc = DocumentEntity.builder()
                .docId(77L)
                .repoId(10L)
                .title("Tài liệu Kiến trúc Microservice")
                .build();
        when(documentRepository.findByRepoIdOrderByUpdatedAtDesc(10L)).thenReturn(List.of(doc));

        String pushPayload = """
                {
                    "repository": {
                        "id": 99999,
                        "full_name": "acme/my-service"
                    },
                    "after": "abcdef1234567890abcdef1234567890abcdef12",
                    "before": "0000000000000000000000000000000000000000",
                    "pusher": {
                        "name": "developer-john"
                    },
                    "commits": [
                        {
                            "id": "abcdef1234567890abcdef1234567890abcdef12",
                            "message": "feat: add PaymentController endpoint",
                            "author": { "name": "developer-john", "email": "john@example.com" },
                            "added": ["src/main/java/com/example/PaymentController.java"]
                        }
                    ]
                }
                """;

        var result = webhookService.processWebhook("push", pushPayload);

        assertTrue(result.success());
        assertEquals("push", result.eventType());

        ArgumentCaptor<DocumentChangeAlertEntity> alertCaptor = ArgumentCaptor.forClass(DocumentChangeAlertEntity.class);
        verify(alertRepository, times(1)).save(alertCaptor.capture());

        DocumentChangeAlertEntity savedAlert = alertCaptor.getValue();
        assertEquals(10L, savedAlert.getRepositoryId());
        assertEquals(77L, savedAlert.getDocumentId());
        assertEquals("PENDING", savedAlert.getStatus());
        assertEquals("abcdef1234567890abcdef1234567890abcdef12", savedAlert.getSourceCommit());
        assertTrue(savedAlert.getDetails().contains("PaymentController"));
    }

    @Test
    @DisplayName("Webhook PR: Tạo DocumentChangeAlertEntity trạng thái PENDING cho PR opened")
    void testHandlePullRequestEvent_GeneratesPendingAlertForPr() {
        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(20L)
                .githubRepoId(88888L)
                .repoFullName("acme/billing-app")
                .build();

        when(repositoryRepository.findAll()).thenReturn(List.of(repo));
        when(alertRepository.findByRepositoryId(20L)).thenReturn(Collections.emptyList());
        when(pullRequestRepository.findByRepositoryIdAndPrNumber(20L, 15)).thenReturn(Optional.empty());

        DocumentEntity doc = DocumentEntity.builder()
                .docId(88L)
                .repoId(20L)
                .title("Billing API Spec")
                .build();
        when(documentRepository.findByRepoIdOrderByUpdatedAtDesc(20L)).thenReturn(List.of(doc));

        String prPayload = """
                {
                    "action": "opened",
                    "repository": {
                        "id": 88888,
                        "full_name": "acme/billing-app"
                    },
                    "pull_request": {
                        "id": 123456,
                        "number": 15,
                        "title": "Refactor billing engine logic",
                        "state": "open",
                        "user": { "login": "alice-dev" },
                        "head": { "ref": "feat-billing", "sha": "head-sha-999" },
                        "base": { "ref": "main", "sha": "base-sha-111" }
                    }
                }
                """;

        var result = webhookService.processWebhook("pull_request", prPayload);

        assertTrue(result.success());
        assertEquals("pull_request", result.eventType());

        ArgumentCaptor<DocumentChangeAlertEntity> alertCaptor = ArgumentCaptor.forClass(DocumentChangeAlertEntity.class);
        verify(alertRepository, times(1)).save(alertCaptor.capture());

        DocumentChangeAlertEntity savedAlert = alertCaptor.getValue();
        assertEquals(20L, savedAlert.getRepositoryId());
        assertEquals(88L, savedAlert.getDocumentId());
        assertEquals(15L, savedAlert.getSourcePrId());
        assertEquals("HIGH", savedAlert.getSeverity());
        assertEquals("PENDING", savedAlert.getStatus());
        assertTrue(savedAlert.getDetails().contains("Pull Request #15"));
    }

    @Test
    @DisplayName("Webhook Idempotency: Không tạo trùng lặp cảnh báo PENDING cho cùng một commit SHA")
    void testHandlePushEvent_AvoidsDuplicatePendingAlerts() {
        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(10L)
                .githubRepoId(99999L)
                .repoFullName("acme/my-service")
                .build();

        when(repositoryRepository.findAll()).thenReturn(List.of(repo));

        DocumentChangeAlertEntity existingAlert = DocumentChangeAlertEntity.builder()
                .repositoryId(10L)
                .sourceCommit("abcdef123456")
                .status("PENDING")
                .build();
        when(alertRepository.findByRepositoryId(10L)).thenReturn(List.of(existingAlert));

        String pushPayload = """
                {
                    "repository": {
                        "id": 99999,
                        "full_name": "acme/my-service"
                    },
                    "after": "abcdef123456",
                    "commits": []
                }
                """;

        var result = webhookService.processWebhook("push", pushPayload);

        assertTrue(result.success());
        verify(alertRepository, never()).save(any());
    }
}
