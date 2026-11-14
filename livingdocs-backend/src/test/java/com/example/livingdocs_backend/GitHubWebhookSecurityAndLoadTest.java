package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.GitHubWebhookServicePort;
import com.example.livingdocs_backend.application.service.GitHubWebhookServiceImpl;
import com.example.livingdocs_backend.infrastructure.web.controller.GitHubWebhookController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GitHubWebhookSecurityAndLoadTest {

    private static final String TEST_SECRET = "livingdocs-super-secret-hmac-key-2026";
    private GitHubWebhookServiceImpl webhookServiceImpl;
    private GitHubWebhookController controller;

    @BeforeEach
    void setUp() {
        webhookServiceImpl = new GitHubWebhookServiceImpl(
                null, null, null, null, null, null, null
        );
        ReflectionTestUtils.setField(webhookServiceImpl, "webhookSecret", TEST_SECRET);

        GitHubWebhookServicePort mockPort = mock(GitHubWebhookServicePort.class);
        when(mockPort.verifySignature(anyString(), anyString()))
                .thenAnswer(inv -> webhookServiceImpl.verifySignature(inv.getArgument(0), inv.getArgument(1)));
        when(mockPort.verifySignature(anyString(), org.mockito.ArgumentMatchers.isNull()))
                .thenAnswer(inv -> webhookServiceImpl.verifySignature(inv.getArgument(0), null));
        when(mockPort.processWebhook(anyString(), anyString()))
                .thenReturn(WebhookProcessingResult.builder()
                        .success(true)
                        .eventType("pull_request")
                        .message("Queued for background analysis")
                        .build());

        controller = new GitHubWebhookController(mockPort);
    }

    private String computeHmacSha256(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hmac = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return "sha256=" + HexFormat.of().formatHex(hmac);
    }

    @Test
    @DisplayName("Từ chối ngay lập tức với mã 401 khi chữ ký HMAC-SHA256 không hợp lệ")
    void shouldRejectInvalidSignatureWith401() {
        String payload = "{\"action\":\"opened\",\"number\":101}";
        ResponseEntity<?> response = controller.handleGitHubWebhook(
                "pull_request",
                "sha256=invalid_signature_hash_123456",
                UUID.randomUUID().toString(),
                payload
        );

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Từ chối ngay lập tức với mã 401 khi thiếu header X-Hub-Signature-256")
    void shouldRejectMissingSignatureWith401() {
        String payload = "{\"zen\":\"Design for failure.\"}";
        ResponseEntity<?> response = controller.handleGitHubWebhook(
                "ping",
                null,
                UUID.randomUUID().toString(),
                payload
        );

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Chặn tấn công phát lại (Replay Attack) khi gửi trùng X-GitHub-Delivery")
    void shouldBlockReplayAttackWithDuplicateDeliveryId() throws Exception {
        String payload = "{\"action\":\"synchronize\",\"number\":202}";
        String signature = computeHmacSha256(payload, TEST_SECRET);
        String deliveryId = UUID.randomUUID().toString();

        ResponseEntity<?> firstResponse = controller.handleGitHubWebhook(
                "pull_request", signature, deliveryId, payload
        );
        assertEquals(HttpStatus.OK, firstResponse.getStatusCode());

        ResponseEntity<?> replayResponse = controller.handleGitHubWebhook(
                "pull_request", signature, deliveryId, payload
        );
        assertEquals(HttpStatus.UNAUTHORIZED, replayResponse.getStatusCode());
    }

    @Test
    @DisplayName("Kiểm thử tải: Đẩy đồng thời 20 sự kiện webhook hợp lệ, phản hồi 200 OK dưới 500ms")
    void shouldHandle20ConcurrentWebhooksUnder500ms() throws Exception {
        int concurrentRequests = 20;
        ExecutorService executor = Executors.newFixedThreadPool(concurrentRequests);
        List<Callable<Long>> tasks = new ArrayList<>();

        for (int i = 0; i < concurrentRequests; i++) {
            final int idx = i;
            tasks.add(() -> {
                String payload = String.format("{\"action\":\"opened\",\"number\":%d}", 1000 + idx);
                String signature = computeHmacSha256(payload, TEST_SECRET);
                String deliveryId = UUID.randomUUID().toString();

                long start = System.currentTimeMillis();
                ResponseEntity<?> res = controller.handleGitHubWebhook(
                        "pull_request", signature, deliveryId, payload
                );
                long elapsed = System.currentTimeMillis() - start;

                assertEquals(HttpStatus.OK, res.getStatusCode(), "Request #" + idx + " phải trả về 200 OK");
                return elapsed;
            });
        }

        List<Future<Long>> futures = executor.invokeAll(tasks);
        executor.shutdown();

        for (int i = 0; i < futures.size(); i++) {
            long elapsedMs = futures.get(i).get();
            assertTrue(elapsedMs < 500, "Request #" + i + " mất " + elapsedMs + "ms (>= 500ms)");
        }
    }
}

