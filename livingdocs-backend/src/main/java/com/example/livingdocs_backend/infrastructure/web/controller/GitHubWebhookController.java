package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;
import com.example.livingdocs_backend.application.port.GitHubWebhookServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller tiếp nhận và xác thực sự kiện Webhook từ GitHub (push,
 * pull_request, ping).
 * Xác thực bảo mật chữ ký HMAC SHA-256 (X-Hub-Signature-256).
 * Phản hồi nhanh HTTP 200 trong vòng < 500ms và đẩy sự kiện vào luồng phân tích
 * ngầm.
 */
@Slf4j
@RestController
@RequestMapping("/api/webhooks/github")
@RequiredArgsConstructor
@Tag(name = "GitHub Webhooks", description = "Cổng tiếp nhận sự kiện tự động từ GitHub (push, pull_request)")
public class GitHubWebhookController {

    private final GitHubWebhookServicePort webhookService;

    @PostMapping
    @Operation(summary = "Tiếp nhận và xử lý sự kiện Webhook từ GitHub", description = "Bắt các sự kiện thay đổi mã nguồn (push, pull_request), xác thực chữ ký X-Hub-Signature-256 và đẩy vào luồng phân tích")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Tiếp nhận thành công và đã đẩy vào hàng đợi phân tích"),
            @ApiResponse(responseCode = "401", description = "Chữ ký X-Hub-Signature-256 không hợp lệ"),
            @ApiResponse(responseCode = "400", description = "Payload JSON không hợp lệ hoặc thiếu dữ liệu")
    })
    public ResponseEntity<?> handleGitHubWebhook(
            @RequestHeader(value = "X-GitHub-Event", defaultValue = "ping") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signatureHeader,
            @RequestBody String rawPayload) {
        long startTime = System.currentTimeMillis();
        log.info("[Webhook] Nhận Webhook từ GitHub - Event: {}", eventType);

        // 1. Xác thực chữ ký bí mật HMAC-SHA256 (X-Hub-Signature-256)
        boolean isValid = webhookService.verifySignature(rawPayload, signatureHeader);
        if (!isValid) {
            long duration = System.currentTimeMillis() - startTime;
            log.warn("[Webhook] Chữ ký X-Hub-Signature-256 không hợp lệ. Từ chối yêu cầu (thời gian: {}ms)", duration);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "status", 401,
                            "error", "Unauthorized",
                            "message", "Chữ ký X-Hub-Signature-256 không hợp lệ hoặc không khớp secret key"));
        }

        // 2. Phân tích payload, trích xuất metadata và đẩy vào luồng phân tích ngầm
        WebhookProcessingResult result = webhookService.processWebhook(eventType, rawPayload);
        long duration = System.currentTimeMillis() - startTime;

        if (!result.success()) {
            log.warn("[Webhook] Xử lý sự kiện [{}] thất bại sau {}ms: {}", eventType, duration, result.message());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
        }

        log.info("[Webhook] Hoàn tất tiếp nhận sự kiện [{}] thành công trong {}ms (< 500ms)", eventType, duration);
        return ResponseEntity.ok(result);
    }
}
