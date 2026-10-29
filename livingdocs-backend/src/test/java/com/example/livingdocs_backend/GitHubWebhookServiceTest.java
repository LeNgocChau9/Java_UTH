package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.application.service.GitHubWebhookServiceImpl;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCommitRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class GitHubWebhookServiceTest {

    private SpringDataRepositoryRepository repositoryRepository;
    private SpringDataPullRequestRepository pullRequestRepository;
    private SpringDataCommitRepository commitRepository;
    private ObjectMapper objectMapper;
    private JobQueue jobQueue;

    private GitHubWebhookServiceImpl webhookService;

    private final String secret = "my_webhook_secret_12345";

    @BeforeEach
    void setUp() {
        repositoryRepository = mock(SpringDataRepositoryRepository.class);
        pullRequestRepository = mock(SpringDataPullRequestRepository.class);
        commitRepository = mock(SpringDataCommitRepository.class);
        objectMapper = new ObjectMapper();
        jobQueue = mock(JobQueue.class);

        webhookService = new GitHubWebhookServiceImpl(
                repositoryRepository,
                pullRequestRepository,
                commitRepository,
                objectMapper,
                jobQueue
        );

        ReflectionTestUtils.setField(webhookService, "webhookSecret", secret);
    }

    @Test
    @DisplayName("Chữ ký HMAC SHA-256: Hợp lệ khi hash khớp")
    void shouldVerifySignatureSuccessfully() throws Exception {
        String payload = "{\"zen\": \"Practicality beats purity.\"}";

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) {
            hex.append(String.format("%02x", b));
        }

        String signature = "sha256=" + hex.toString();

        boolean result = webhookService.verifySignature(payload, signature);
        assertTrue(result, "Chữ ký hợp lệ phải trả về true");
    }

    @Test
    @DisplayName("Chữ ký HMAC SHA-256: Bị từ chối khi hash sai")
    void shouldRejectInvalidSignature() {
        String payload = "{\"hello\": \"world\"}";
        String invalidSignature = "sha256=abcdef1234567890badhash";

        boolean result = webhookService.verifySignature(payload, invalidSignature);
        assertFalse(result, "Chữ ký sai lệch phải trả về false");
    }

    @Test
    @DisplayName("Xử lý sự kiện Push: Lưu danh sách commits vào database")
    void shouldHandlePushEventAndSaveCommits() {
        String payload = """
                {
                  "repository": {
                    "id": 123456,
                    "full_name": "LeNgocChau9/Java_UTH"
                  },
                  "commits": [
                    {
                      "id": "c1a2b3d4e5f6",
                      "message": "feat: commit 1",
                      "timestamp": "2026-10-19T10:00:00Z",
                      "author": { "name": "Admin", "email": "admin@example.com" }
                    }
                  ]
                }
                """;

        RepositoryEntity mockRepo = RepositoryEntity.builder()
                .repositoryId(10L)
                .githubRepoId(123456L)
                .repoFullName("LeNgocChau9/Java_UTH")
                .build();

        when(repositoryRepository.findAll()).thenReturn(List.of(mockRepo));
        when(commitRepository.findByRepositoryIdAndCommitHash(10L, "c1a2b3d4e5f6")).thenReturn(Optional.empty());

        WebhookProcessingResult result = webhookService.processWebhook("push", payload);

        assertTrue(result.success());
        assertEquals("push", result.eventType());
        assertEquals(1, result.affectedCount());
        verify(commitRepository, times(1)).save(any(CommitEntity.class));
        verify(repositoryRepository, times(1)).save(mockRepo);
    }

    @Test
    @DisplayName("Xử lý sự kiện Pull Request: Lưu PR và tự động đẩy Job quét Drift vào JobQueue")
    void shouldHandlePullRequestEventAndEnqueueDriftScanJob() {
        String payload = """
                {
                  "action": "opened",
                  "repository": {
                    "id": 123456,
                    "full_name": "LeNgocChau9/Java_UTH"
                  },
                  "pull_request": {
                    "id": 98765,
                    "number": 42,
                    "title": "feat: S2-05 Webhook receiver",
                    "state": "open",
                    "merged": false,
                    "head": { "ref": "feature/S2-05", "sha": "head_sha_99" },
                    "base": { "ref": "main", "sha": "base_sha_00" },
                    "user": { "login": "dev_user" },
                    "created_at": "2026-10-19T08:00:00Z"
                  }
                }
                """;

        RepositoryEntity mockRepo = RepositoryEntity.builder()
                .repositoryId(10L)
                .githubRepoId(123456L)
                .repoFullName("LeNgocChau9/Java_UTH")
                .build();

        when(repositoryRepository.findAll()).thenReturn(List.of(mockRepo));
        when(pullRequestRepository.findByRepositoryIdAndPrNumber(10L, 42)).thenReturn(Optional.empty());

        WebhookProcessingResult result = webhookService.processWebhook("pull_request", payload);

        assertTrue(result.success());
        assertEquals("pull_request", result.eventType());
        assertEquals(1, result.affectedCount());
        verify(pullRequestRepository, times(1)).save(any(PullRequestEntity.class));
        verify(repositoryRepository, times(1)).save(mockRepo);

        // Kiểm tra đã tự động kích hoạt Job quét Drift
        verify(jobQueue, times(1)).enqueue(eq(GitHubWebhookServiceImpl.JOB_TYPE_PR_DRIFT_SCAN), anyString());
    }
}
