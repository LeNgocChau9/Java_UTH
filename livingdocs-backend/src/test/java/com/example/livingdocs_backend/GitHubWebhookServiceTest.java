package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

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

class GitHubWebhookServiceTest {

  private SpringDataRepositoryRepository repositoryRepository;
  private SpringDataPullRequestRepository pullRequestRepository;
  private SpringDataCommitRepository commitRepository;
  private ObjectMapper objectMapper;

  private GitHubWebhookServiceImpl webhookService;

  private final String secret = "my_webhook_secret_12345";

  @BeforeEach
  void setUp() {
    repositoryRepository = mock(SpringDataRepositoryRepository.class);
    pullRequestRepository = mock(SpringDataPullRequestRepository.class);
    commitRepository = mock(SpringDataCommitRepository.class);
    objectMapper = new ObjectMapper();

    webhookService = new GitHubWebhookServiceImpl(
        repositoryRepository,
        pullRequestRepository,
        commitRepository,
        objectMapper);

    ReflectionTestUtils.setField(webhookService, "webhookSecret", secret);
  }

  @Test
  @DisplayName("Chữ ký HMAC SHA-256: Hợp lệ khi hash khớp")
  void shouldVerifySignatureSuccessfully() throws Exception {
    String payload = "{\"zen\": \"Practicality beats purity.\"}";

    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    byte[] hashBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
    StringBuilder hex = new StringBuilder();
    for (byte b : hashBytes)
      hex.append(String.format("%02x", b));
    String signatureHeader = "sha256=" + hex.toString();

    boolean valid = webhookService.verifySignature(payload, signatureHeader);
    assertTrue(valid, "Chữ ký phải hợp lệ khi tính đúng hash HMAC SHA-256");
  }

  @Test
  @DisplayName("Chữ ký HMAC SHA-256: Bị từ chối khi hash sai")
  void shouldRejectInvalidSignature() {
    String payload = "{\"zen\": \"test\"}";
    String invalidSignature = "sha256=1111111111111111111111111111111111111111111111111111111111111111";

    boolean valid = webhookService.verifySignature(payload, invalidSignature);
    assertFalse(valid, "Chữ ký sai phải bị từ chối");
  }

  @Test
  @DisplayName("Xử lý sự kiện Push: Lưu danh sách commit vào bảng commits")
  void shouldHandlePushEventAndSaveCommits() {
    String payload = """
        {
          "ref": "refs/heads/main",
          "repository": {
            "id": 123456,
            "full_name": "LeNgocChau9/Java_UTH"
          },
          "commits": [
            {
              "id": "c1a2b3d4e5f6",
              "message": "feat: webhook support",
              "timestamp": "2026-10-19T10:00:00Z",
              "author": {
                "name": "Chau Le",
                "email": "chau@example.com"
              }
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
  @DisplayName("Xử lý sự kiện Pull Request: Lưu thông tin PR vào bảng pull_requests")
  void shouldHandlePullRequestEventAndSavePR() {
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
  }
}
