package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.GitHubWebhookServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller tiếp nhận sự kiện Webhook thật từ GitHub (push, pull_request, ping).
 * Xác thực bảo mật chữ ký HMAC SHA-256 (X-Hub-Signature-256).
 */
@Slf4j
@RestController
@RequestMapping("/api/webhooks/github")
@RequiredArgsConstructor
@Tag(name = "GitHub Webhooks", description = "Cổng tiếp nhận sự kiện tự động từ GitHub (push, PR)")
public class GitHubWebhookController {

    private final GitHubWebhookServicePort webhookService;

    @PostMapping
    @Operation(summary = "Tiếp nhận và xử lý sự kiện Webhook từ GitHub")
    public ResponseEntity<?> handleGitHubWebhook(
            @RequestHeader(value = "X-GitHub-Event", defaultValue = "ping") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signatureHeader,
            @RequestBody String rawPayload
    ) {
        log.info("[Webhook] Nhận Webhook từ GitHub - Event: {}", eventType);

        // 1. Xác thực chữ ký bí mật HMAC-SHA256
        boolean isValid = webhookService.verifySignature(rawPayload, signatureHeader);
        if (!isValid) {
            log.warn("[Webhook] Chữ ký X-Hub-Signature-256 không hợp lệ. Từ chối yêu cầu.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "status", 401,
                            "error", "Unauthorized",
                            "message", "Chữ ký X-Hub-Signature-256 không hợp lệ"
                    ));
        }

        // 2. Phân tích payload và lưu vào CSDL
        WebhookProcessingResult result = webhookService.processWebhook(eventType, rawPayload);

        if (!result.success()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
        }

        return ResponseEntity.ok(result);
    }
}
