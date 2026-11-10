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
        jobQueue);

    ReflectionTestUtils.setField(webhookService, "webhookSecret", secret);
  }

  private String generateSignature(String payload, String key) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
    StringBuilder hex = new StringBuilder();
    for (byte b : bytes) {
      hex.append(String.format("%02x", b));
    }
    return "sha256=" + hex.toString();
  }

  @Test
  @DisplayName("Chữ ký HMAC SHA-256: Hợp lệ khi hash khớp")
  void shouldVerifySignatureSuccessfully() throws Exception {
    String payload = "{\"zen\": \"Practicality beats purity.\"}";
    String signature = generateSignature(payload, secret);

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
  @DisplayName("Chữ ký HMAC SHA-256: Bỏ qua khi secret chưa cấu hình (Development Mode)")
  void shouldBypassSignatureWhenSecretNotConfigured() {
    ReflectionTestUtils.setField(webhookService, "webhookSecret", "");
    boolean result = webhookService.verifySignature("{\"test\": true}", null);
    assertTrue(result, "Khi chưa cấu hình secret thì cho phép bypass");
  }

  @Test
  @DisplayName("Xử lý sự kiện Ping: Phản hồi thành công ngay lập tức")
  void shouldHandlePingEventSuccessfully() {
    WebhookProcessingResult result = webhookService.processWebhook("ping", "{}");
    assertTrue(result.success());
    assertEquals("ping", result.eventType());
  }

  @Test
  @DisplayName("Xử lý sự kiện Push: Lưu danh sách commits và trích xuất đầy đủ metadata")
  void shouldHandlePushEventAndSaveCommits() {
    String payload = """
        {
          "before": "base_sha_111",
          "after": "head_sha_222",
          "repository": {
            "id": 123456,
            "full_name": "LeNgocChau9/Java_UTH"
          },
          "head_commit": {
            "id": "head_sha_222",
            "author": { "name": "Admin Tester", "email": "admin@example.com" }
          },
          "commits": [
            {
              "id": "c1a2b3d4e5f6",
              "message": "feat: commit 1",
              "timestamp": "2026-10-19T10:00:00Z",
              "author": { "name": "Admin Tester", "email": "admin@example.com" }
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
    assertEquals("LeNgocChau9/Java_UTH", result.repoFullName());
    assertEquals("base_sha_111", result.baseCommitSha());
    assertEquals("head_sha_222", result.headCommitSha());
    assertEquals("Admin Tester", result.commitAuthor());
    assertEquals(1, result.affectedCount());
    verify(commitRepository, times(1)).save(any(CommitEntity.class));
    verify(repositoryRepository, times(1)).save(mockRepo);
    verify(jobQueue, times(1)).enqueue(eq(GitHubWebhookServiceImpl.JOB_TYPE_AUTO_DOC_UPDATE), anyString());
  }

  @Test
  @DisplayName("Xử lý sự kiện Pull Request Opened: Lưu PR và tự động đẩy Job quét Drift vào JobQueue")
  void shouldHandlePullRequestOpenedEventAndEnqueueDriftScanJob() {
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
    assertEquals("opened", result.action());
    assertEquals("LeNgocChau9/Java_UTH", result.repoFullName());
    assertEquals(42, result.prNumber());
    assertEquals("base_sha_00", result.baseCommitSha());
    assertEquals("head_sha_99", result.headCommitSha());
    assertEquals("dev_user", result.commitAuthor());
    assertEquals(1, result.affectedCount());
    verify(pullRequestRepository, times(1)).save(any(PullRequestEntity.class));
    verify(repositoryRepository, times(1)).save(mockRepo);

    // Kiểm tra đã tự động kích hoạt Job quét Drift
    verify(jobQueue, times(1)).enqueue(eq(GitHubWebhookServiceImpl.JOB_TYPE_PR_DRIFT_SCAN), anyString());
  }

  @Test
  @DisplayName("Xử lý sự kiện Pull Request Synchronize: Cập nhật commit mới và đẩy Job quét Drift")
  void shouldHandlePullRequestSynchronizeEvent() {
    String payload = """
        {
          "action": "synchronize",
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
            "head": { "ref": "feature/S2-05", "sha": "head_sha_new" },
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

    PullRequestEntity existingPr = PullRequestEntity.builder()
        .repositoryId(10L)
        .prNumber(42)
        .headCommitHash("head_sha_old")
        .build();

    when(repositoryRepository.findAll()).thenReturn(List.of(mockRepo));
    when(pullRequestRepository.findByRepositoryIdAndPrNumber(10L, 42)).thenReturn(Optional.of(existingPr));

    WebhookProcessingResult result = webhookService.processWebhook("pull_request", payload);

    assertTrue(result.success());
    assertEquals("synchronize", result.action());
    assertEquals("head_sha_new", result.headCommitSha());
    verify(pullRequestRepository, times(1)).save(existingPr);
    verify(jobQueue, times(1)).enqueue(eq(GitHubWebhookServiceImpl.JOB_TYPE_PR_DRIFT_SCAN), anyString());
  }

  @Test
  @DisplayName("Xử lý sự kiện Pull Request Closed: Cập nhật trạng thái CLOSED hoặc MERGED")
  void shouldHandlePullRequestClosedEvent() {
    String payload = """
        {
          "action": "closed",
          "repository": {
            "id": 123456,
            "full_name": "LeNgocChau9/Java_UTH"
          },
          "pull_request": {
            "id": 98765,
            "number": 42,
            "title": "feat: S2-05 Webhook receiver",
            "state": "closed",
            "merged": true,
            "head": { "ref": "feature/S2-05", "sha": "head_sha_final" },
            "base": { "ref": "main", "sha": "base_sha_00" },
            "user": { "login": "dev_user" },
            "closed_at": "2026-10-19T12:00:00Z"
          }
        }
        """;

    RepositoryEntity mockRepo = RepositoryEntity.builder()
        .repositoryId(10L)
        .githubRepoId(123456L)
        .repoFullName("LeNgocChau9/Java_UTH")
        .build();

    PullRequestEntity existingPr = PullRequestEntity.builder()
        .repositoryId(10L)
        .prNumber(42)
        .state("OPEN")
        .build();

    when(repositoryRepository.findAll()).thenReturn(List.of(mockRepo));
    when(pullRequestRepository.findByRepositoryIdAndPrNumber(10L, 42)).thenReturn(Optional.of(existingPr));

    WebhookProcessingResult result = webhookService.processWebhook("pull_request", payload);

    assertTrue(result.success());
    assertEquals("closed", result.action());
    assertEquals("MERGED", existingPr.getState());
    verify(pullRequestRepository, times(1)).save(existingPr);
    // Closed PR không kích hoạt drift scan job mà kích hoạt auto-update pipeline khi merged
    verify(jobQueue, never()).enqueue(eq(GitHubWebhookServiceImpl.JOB_TYPE_PR_DRIFT_SCAN), anyString());
    verify(jobQueue, times(1)).enqueue(eq(GitHubWebhookServiceImpl.JOB_TYPE_AUTO_DOC_UPDATE), anyString());
  }
}
