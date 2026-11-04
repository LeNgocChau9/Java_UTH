package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.GitHubWebhookServicePort;
import com.example.livingdocs_backend.infrastructure.web.controller.GitHubWebhookController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class GitHubWebhookControllerTest {

    @Mock
    private GitHubWebhookServicePort webhookService;

    private GitHubWebhookController controller;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        controller = new GitHubWebhookController(webhookService);
    }

    @Test
    @DisplayName("POST /api/webhooks/github: Trả về HTTP 200 OK khi chữ ký và payload hợp lệ")
    void shouldReturn200WhenValidSignatureAndPayload() {
        String rawPayload = "{\"repository\": {\"full_name\": \"LeNgocChau9/Java_UTH\"}}";
        String signature = "sha256=abcdef1234567890";

        WebhookProcessingResult mockResult = WebhookProcessingResult.builder()
                .success(true)
                .eventType("pull_request")
                .action("opened")
                .repoFullName("LeNgocChau9/Java_UTH")
                .prNumber(12)
                .baseCommitSha("base_sha")
                .headCommitSha("head_sha")
                .commitAuthor("dev_user")
                .affectedCount(1)
                .message("Đã cập nhật PR #12")
                .build();

        when(webhookService.verifySignature(rawPayload, signature)).thenReturn(true);
        when(webhookService.processWebhook("pull_request", rawPayload)).thenReturn(mockResult);

        long start = System.currentTimeMillis();
        ResponseEntity<?> response = controller.handleGitHubWebhook("pull_request", signature, rawPayload);
        long duration = System.currentTimeMillis() - start;

        // Phải phản hồi trong vòng < 500ms
        assertTrue(duration < 500, "Thời gian phản hồi phải nhỏ hơn 500ms");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof WebhookProcessingResult);

        WebhookProcessingResult result = (WebhookProcessingResult) response.getBody();
        assertTrue(result.success());
        assertEquals("LeNgocChau9/Java_UTH", result.repoFullName());
        assertEquals(12, result.prNumber());
        assertEquals("dev_user", result.commitAuthor());
    }

    @Test
    @DisplayName("POST /api/webhooks/github: Trả về HTTP 401 Unauthorized khi chữ ký không hợp lệ")
    void shouldReturn401WhenInvalidSignature() {
        String rawPayload = "{\"test\": 123}";
        String signature = "sha256=invalid";

        when(webhookService.verifySignature(rawPayload, signature)).thenReturn(false);

        ResponseEntity<?> response = controller.handleGitHubWebhook("push", signature, rawPayload);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(401, body.get("status"));
        assertEquals("Unauthorized", body.get("error"));
        verify(webhookService, never()).processWebhook(anyString(), anyString());
    }

    @Test
    @DisplayName("POST /api/webhooks/github: Trả về HTTP 400 Bad Request khi payload thiếu dữ liệu")
    void shouldReturn400WhenProcessingFails() {
        String rawPayload = "{}";
        String signature = "sha256=abcdef";

        WebhookProcessingResult mockResult = WebhookProcessingResult.builder()
                .success(false)
                .eventType("push")
                .message("Thiếu thông tin repository trong payload")
                .build();

        when(webhookService.verifySignature(rawPayload, signature)).thenReturn(true);
        when(webhookService.processWebhook("push", rawPayload)).thenReturn(mockResult);

        ResponseEntity<?> response = controller.handleGitHubWebhook("push", signature, rawPayload);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody() instanceof WebhookProcessingResult);
        WebhookProcessingResult result = (WebhookProcessingResult) response.getBody();
        assertFalse(result.success());
    }
}
