package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.github.WebhookProcessingResult;

/**
 * Port xử lý tiếp nhận và xác thực Webhook từ GitHub.
 */
public interface GitHubWebhookServicePort {

    /**
     * Xác thực chữ ký bí mật X-Hub-Signature-256 (HMAC SHA-256) của request webhook.
     *
     * @param payloadRaw Payload thô dạng byte[] hoặc chuỗi
     * @param signatureHeader Header X-Hub-Signature-256 (ví dụ: sha256=abcdef...)
     * @return true nếu chữ ký hợp lệ hoặc hệ thống chưa cấu hình secret; false nếu sai chữ ký
     */
    boolean verifySignature(String payloadRaw, String signatureHeader);

    /**
     * Xử lý sự kiện Webhook từ GitHub (push hoặc pull_request) và lưu vào CSDL.
     *
     * @param eventType Event type từ header X-GitHub-Event (vd: "push", "pull_request", "ping")
     * @param payloadJson Payload JSON từ GitHub
     * @return Kết quả xử lý
     */
    WebhookProcessingResult processWebhook(String eventType, String payloadJson);
}
