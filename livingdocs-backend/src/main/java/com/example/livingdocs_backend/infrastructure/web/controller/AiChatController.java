package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.service.AiRuntimeConfigService;
import com.example.livingdocs_backend.infrastructure.ai.GeminiDirectClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Controller tiếp nhận yêu cầu hỏi đáp Chatbot AI từ giao diện người dùng.
 * Truy xuất ngữ cảnh RAG (top-K knowledge_chunks + code_entities) gắn vào prompt hỏi đáp có căn cứ (R8).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ai")
public class AiChatController {

    private final RestClient restClient;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private AiRuntimeConfigService aiRuntimeConfigService;

    @Autowired(required = false)
    private GeminiDirectClient geminiDirectClient;

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
        Map<String, Object> payload = requestPayload != null ? new HashMap<>(requestPayload) : new HashMap<>();

        // 1. Lan truyền cấu hình AI Runtime từ Admin Settings
        if (aiRuntimeConfigService != null) {
            aiRuntimeConfigService.applyRuntimeSettings(payload);
        }

        // 2. Trích xuất context repoId / docId để truy vấn Grounding Context (R8)
        Long repositoryId = extractLong(payload.get("repositoryId"));
        if (repositoryId == null) {
            repositoryId = extractLong(payload.get("repoId"));
        }
        Long docId = extractLong(payload.get("docId"));
        String message = payload.get("message") != null ? String.valueOf(payload.get("message")).trim() : "";

        if (repositoryId != null && !message.isBlank() && jdbcTemplate != null) {
            enrichWithGroundingContext(payload, repositoryId, docId, message);
        }

        // 3. Gửi sang AI Engine (/v1/chat)
        try {
            Map<String, Object> response = restClient.post()
                    .uri("/v1/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("reply")) {
                return ResponseEntity.ok(response);
            }
        } catch (Exception ex) {
            log.warn("[AiChatController] Không thể kết nối AI Engine (/v1/chat): {}. Chuyển sang kích hoạt Google Gemini Cloud...", ex.getMessage());
        }

        // 4. Kích hoạt trực tiếp Google Gemini Cloud nếu AI Engine offline (Render production)
        if (geminiDirectClient != null && geminiDirectClient.isAvailable()) {
            try {
                StringBuilder ragContext = new StringBuilder();
                if (payload.get("context_chunks") instanceof List<?> chunks && !chunks.isEmpty()) {
                    ragContext.append("### TÀI LIỆU LIÊN QUAN:\n");
                    for (Object c : chunks) {
                        ragContext.append(c.toString()).append("\n");
                    }
                }
                if (payload.get("code_entities") instanceof List<?> entities && !entities.isEmpty()) {
                    ragContext.append("\n### THỰC THỂ MÃ NGUỒN LIÊN QUAN:\n");
                    for (Object e : entities) {
                        ragContext.append(e.toString()).append("\n");
                    }
                }

                log.info("[AiChatController] Hỏi đáp qua Google Gemini Direct Client...");
                var geminiReply = geminiDirectClient.answerChat(message, ragContext.toString());
                if (geminiReply.isPresent() && !geminiReply.get().isBlank()) {
                    return ResponseEntity.ok(Map.of(
                            "status", "success",
                            "provider", "gemini_cloud",
                            "model", "Google Gemini Flash",
                            "reply", geminiReply.get()
                    ));
                }
            } catch (Exception ex) {
                log.warn("[AiChatController] Lỗi khi gọi Gemini Direct Chat: {}", ex.getMessage());
            }
        }

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

    private void enrichWithGroundingContext(Map<String, Object> payload, Long repositoryId, Long docId, String message) {
        List<Map<String, Object>> contextChunks = new ArrayList<>();
        List<Map<String, Object>> codeEntities = new ArrayList<>();

        // A. Tạo embedding câu hỏi từ AI Engine (/v1/embeddings)
        String vectorStr = null;
        try {
            Map<String, Object> embReq = new HashMap<>();
            embReq.put("text", message);
            if (aiRuntimeConfigService != null) {
                aiRuntimeConfigService.applyRuntimeSettings(embReq);
            }
            Map<String, Object> embResp = restClient.post()
                    .uri("/v1/embeddings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(embReq)
                    .retrieve()
                    .body(Map.class);
            if (embResp != null && embResp.get("embedding") instanceof List<?> list) {
                vectorStr = formatVector(list);
            }
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể tạo vector embedding cho câu hỏi: {}", ex.getMessage());
        }

        // B. Truy vấn top-3 knowledge_chunks qua pgvector <=> (hoặc fallback keyword)
        try {
            if (vectorStr != null) {
                String sql = """
                    SELECT source_path, content
                    FROM knowledge_chunks
                    WHERE repository_id = ? AND embedding IS NOT NULL
                    ORDER BY embedding <=> ?::vector ASC
                    LIMIT 3
                """;
                List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("source_path", rs.getString("source_path"));
                    item.put("title", rs.getString("source_path"));
                    item.put("content", rs.getString("content"));
                    return item;
                }, repositoryId, vectorStr);
                contextChunks.addAll(rows);
            }
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn vector similarity: {}", ex.getMessage());
        }

        // Fallback FTS/ILIKE nếu contextChunks rỗng
        if (contextChunks.isEmpty()) {
            try {
                String kw = "%" + message.replaceAll("\\s+", "%") + "%";
                String sql = "SELECT source_path, content FROM knowledge_chunks WHERE repository_id = ? AND content ILIKE ? LIMIT 3";
                List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("source_path", rs.getString("source_path"));
                    item.put("title", rs.getString("source_path"));
                    item.put("content", rs.getString("content"));
                    return item;
                }, repositoryId, kw);
                contextChunks.addAll(rows);
            } catch (Exception ex) {
                log.debug("[AiChatController] Bỏ qua fallback FTS cho knowledge_chunks: {}", ex.getMessage());
            }
        }

        // C. Truy vấn top-3 code_entities liên quan theo từ khóa câu hỏi
        try {
            String[] tokens = message.split("\\s+");
            String sampleToken = tokens.length > 0 ? tokens[0] : message;
            String tokenPattern = "%" + sampleToken + "%";
            String sql = """
                SELECT file_path, signature, doc_status
                FROM code_entities
                WHERE repository_id = ? AND (signature ILIKE ? OR class_name ILIKE ? OR method_name ILIKE ?)
                LIMIT 3
            """;
            List<Map<String, Object>> entities = jdbcTemplate.query(sql, (rs, rowNum) -> {
                Map<String, Object> item = new HashMap<>();
                item.put("file_path", rs.getString("file_path"));
                item.put("signature", rs.getString("signature"));
                item.put("docstring", rs.getString("doc_status"));
                return item;
            }, repositoryId, tokenPattern, tokenPattern, tokenPattern);
            codeEntities.addAll(entities);
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn code_entities: {}", ex.getMessage());
        }

        if (!contextChunks.isEmpty()) {
            payload.put("context_chunks", contextChunks);
            payload.put("contextChunks", contextChunks);
        }
        if (!codeEntities.isEmpty()) {
            payload.put("code_entities", codeEntities);
            payload.put("codeEntities", codeEntities);
        }
    }

    private Long extractLong(Object val) {
        if (val instanceof Number n) {
            return n.longValue();
        }
        if (val != null) {
            try {
                return Long.parseLong(val.toString().trim());
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private String formatVector(List<?> list) {
        if (list == null || list.isEmpty()) return null;
        return "[" + list.stream().map(Object::toString).collect(Collectors.joining(",")) + "]";
    }
}
