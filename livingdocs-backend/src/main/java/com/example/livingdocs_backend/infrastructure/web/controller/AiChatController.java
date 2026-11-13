package com.example.livingdocs_backend.infrastructure.web.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Map;

/**
 * Controller tiếp nhận yêu cầu hỏi đáp Chatbot AI từ giao diện người dùng.
 * Chuyển tiếp tới AI Engine (/v1/chat) với cơ chế ưu tiên Google Gemini Key,
 * tự động xoay vòng key khi quá quota (429), và failover sang AI Local (Ollama).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ai")
public class AiChatController {

    private final RestClient restClient;

    public AiChatController(@Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl) {
        this.restClient = RestClient.builder()
                .baseUrl(aiEngineUrl)
                .requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(
                        java.net.http.HttpClient.newBuilder()
                                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                                .connectTimeout(Duration.ofSeconds(10))
                                .build()
                ))
                .build();
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chatWithAi(@RequestBody Map<String, Object> requestPayload) {
        log.info("[AiChatController] Nhận tin nhắn chat từ người dùng");
        try {
            Map<String, Object> response = restClient.post()
                    .uri("/v1/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestPayload)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("reply")) {
                return ResponseEntity.ok(response);
            }
        } catch (Exception ex) {
            log.warn("[AiChatController] Không thể kết nối AI Engine (/v1/chat): {}. Sử dụng bộ phản hồi dự phòng.", ex.getMessage());
        }

        String userMsg = requestPayload != null && requestPayload.get("message") != null
                ? String.valueOf(requestPayload.get("message")).toLowerCase()
                : "";

        String fallbackReply = "Chào bạn! Tôi là **Trợ lý AI LivingDocs**.\n\n"
                + "Tôi sẵn sàng hỗ trợ bạn về:\n"
                + "- **Workspace:** Soạn thảo, nạp và xuất tài liệu Word (`.docx`), đối chiếu Template chuẩn.\n"
                + "- **Khoảng trống tài liệu:** Tìm kiếm các Class, Method chưa có tài liệu và tự động sinh bổ sung.\n"
                + "- **Cây mã nguồn (AST):** Bóc tách các thành phần mã nguồn bằng Tree-sitter AST.\n"
                + "- **Cảnh báo sai lệch (Drift):** Phát hiện code thay đổi so với tài liệu hiện tại.\n\n"
                + "*Hệ thống đang sẵn sàng, bạn hãy đặt câu hỏi chi tiết để được hỗ trợ nhé!*";

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "provider", "fallback",
                "model", "LivingDocs Assistant (Offline Guide)",
                "reply", fallbackReply
        ));
    }
}
