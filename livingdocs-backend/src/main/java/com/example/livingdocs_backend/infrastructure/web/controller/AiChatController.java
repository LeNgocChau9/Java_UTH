package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.service.AiRuntimeConfigService;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.infrastructure.ai.GeminiDirectClient;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Controller tiếp nhận yêu cầu hỏi đáp Chatbot AI từ giao diện người dùng.
 * Truy xuất ngữ cảnh RAG (top-K knowledge_chunks + code_entities) có cách ly multi-tenant (R8).
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

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

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

        // 1. Trích xuất context repoId / docId và kiểm tra quyền truy cập multi-tenant TRƯỚC KHI truy vấn DB RAG
        Long repositoryId = extractLong(payload.get("repositoryId"));
        if (repositoryId == null) {
            repositoryId = extractLong(payload.get("repoId"));
        }
        Long docId = extractLong(payload.get("docId"));
        String message = payload.get("message") != null ? String.valueOf(payload.get("message")).trim() : "";

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticated = auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserPrincipal;

        if (repositoryId != null || docId != null) {
            if (!isAuthenticated) {
                throw AuthenticationException.unauthorized(
                        "Vui lòng đăng nhập để sử dụng trợ lý AI theo tài liệu hoặc kho mã nguồn của doanh nghiệp.");
            }
            if (tenantAccessService != null) {
                if (repositoryId != null) {
                    tenantAccessService.requireRepositoryAccess(repositoryId);
                }
                if (docId != null) {
                    tenantAccessService.requireDocumentAccess(docId);
                }
            }
        }

        // 2. Lan truyền cấu hình AI Runtime theo doanh nghiệp hiện tại (chỉ khi đã xác thực hoặc cấu hình mặc định)
        if (aiRuntimeConfigService != null) {
            aiRuntimeConfigService.applyRuntimeSettings(payload);
        }

        // 3. Truy xuất ngữ cảnh Grounding RAG an toàn theo tenant
        if (!message.isBlank() && jdbcTemplate != null) {
            if (repositoryId != null) {
                enrichWithGroundingContextByRepo(payload, repositoryId, message);
            } else if (docId != null) {
                enrichWithGroundingContextByDoc(payload, docId, message);
            } else if (isAuthenticated && tenantAccessService != null) {
                TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
                // Unassigned non-ADMIN: bỏ qua RAG DB để không rò rỉ dữ liệu doanh nghiệp khác
                if (scope.hasTenantFilter()) {
                    enrichWithGroundingContextByWorkspace(payload, scope.workspaceId(), message);
                }
            }
        }

        // 4. Gửi sang AI Engine (/v1/chat)
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

        // 5. Kích hoạt trực tiếp Google Gemini Cloud nếu AI Engine offline (Render production)
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
                            "provider", "gemini",
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

    private void enrichWithGroundingContextByRepo(Map<String, Object> payload, Long repositoryId, String message) {
        List<Map<String, Object>> contextChunks = new ArrayList<>();
        List<Map<String, Object>> codeEntities = new ArrayList<>();

        String vectorStr = fetchQueryEmbedding(message);

        try {
            if (vectorStr != null) {
                String sql = """
                    SELECT source_path, content
                    FROM knowledge_chunks
                    WHERE repository_id = ? AND embedding IS NOT NULL
                    ORDER BY embedding <=> ?::vector ASC
                    LIMIT 3
                """;
                contextChunks.addAll(queryChunks(sql, repositoryId, vectorStr));
            }
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn vector similarity: {}", ex.getMessage());
        }

        if (contextChunks.isEmpty()) {
            try {
                String kw = "%" + message.replaceAll("\\s+", "%") + "%";
                String sql = "SELECT source_path, content FROM knowledge_chunks WHERE repository_id = ? AND content ILIKE ? LIMIT 3";
                contextChunks.addAll(queryChunks(sql, repositoryId, kw));
            } catch (Exception ex) {
                log.debug("[AiChatController] Bỏ qua fallback FTS cho knowledge_chunks: {}", ex.getMessage());
            }
        }

        try {
            String tokenPattern = "%" + firstToken(message) + "%";
            String sql = """
                SELECT file_path, signature, doc_status
                FROM code_entities
                WHERE repository_id = ? AND (signature ILIKE ? OR class_name ILIKE ? OR method_name ILIKE ?)
                LIMIT 3
            """;
            codeEntities.addAll(queryCodeEntities(sql, repositoryId, tokenPattern, tokenPattern, tokenPattern));
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn code_entities: {}", ex.getMessage());
        }

        attachContext(payload, contextChunks, codeEntities);
    }

    private void enrichWithGroundingContextByDoc(Map<String, Object> payload, Long docId, String message) {
        List<Map<String, Object>> contextChunks = new ArrayList<>();
        String vectorStr = fetchQueryEmbedding(message);

        try {
            if (vectorStr != null) {
                String sql = """
                    SELECT source_path, content
                    FROM knowledge_chunks
                    WHERE document_id = ? AND embedding IS NOT NULL
                    ORDER BY embedding <=> ?::vector ASC
                    LIMIT 3
                """;
                contextChunks.addAll(queryChunks(sql, docId, vectorStr));
            }
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn vector similarity theo docId: {}", ex.getMessage());
        }

        if (contextChunks.isEmpty()) {
            try {
                String kw = "%" + message.replaceAll("\\s+", "%") + "%";
                String sql = "SELECT source_path, content FROM knowledge_chunks WHERE document_id = ? AND content ILIKE ? LIMIT 3";
                contextChunks.addAll(queryChunks(sql, docId, kw));
            } catch (Exception ex) {
                log.debug("[AiChatController] Bỏ qua fallback FTS theo docId: {}", ex.getMessage());
            }
        }

        attachContext(payload, contextChunks, Collections.emptyList());
    }

    private void enrichWithGroundingContextByWorkspace(Map<String, Object> payload, Long workspaceId, String message) {
        List<Map<String, Object>> contextChunks = new ArrayList<>();
        List<Map<String, Object>> codeEntities = new ArrayList<>();

        String vectorStr = fetchQueryEmbedding(message);

        try {
            if (vectorStr != null) {
                String sql = """
                    SELECT kc.source_path, kc.content
                    FROM knowledge_chunks kc
                    JOIN repositories r ON r.repository_id = kc.repository_id
                    WHERE r.workspace_id = ? AND kc.embedding IS NOT NULL
                    ORDER BY kc.embedding <=> ?::vector ASC
                    LIMIT 3
                """;
                contextChunks.addAll(queryChunks(sql, workspaceId, vectorStr));
            }
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn vector similarity theo workspace: {}", ex.getMessage());
        }

        if (contextChunks.isEmpty()) {
            try {
                String kw = "%" + message.replaceAll("\\s+", "%") + "%";
                String sql = """
                    SELECT kc.source_path, kc.content
                    FROM knowledge_chunks kc
                    JOIN repositories r ON r.repository_id = kc.repository_id
                    WHERE r.workspace_id = ? AND kc.content ILIKE ?
                    LIMIT 3
                """;
                contextChunks.addAll(queryChunks(sql, workspaceId, kw));
            } catch (Exception ex) {
                log.debug("[AiChatController] Bỏ qua fallback FTS theo workspace: {}", ex.getMessage());
            }
        }

        try {
            String tokenPattern = "%" + firstToken(message) + "%";
            String sql = """
                SELECT ce.file_path, ce.signature, ce.doc_status
                FROM code_entities ce
                JOIN repositories r ON r.repository_id = ce.repository_id
                WHERE r.workspace_id = ? AND (ce.signature ILIKE ? OR ce.class_name ILIKE ? OR ce.method_name ILIKE ?)
                LIMIT 3
            """;
            codeEntities.addAll(queryCodeEntities(sql, workspaceId, tokenPattern, tokenPattern, tokenPattern));
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể truy vấn code_entities theo workspace: {}", ex.getMessage());
        }

        attachContext(payload, contextChunks, codeEntities);
    }

    private String fetchQueryEmbedding(String message) {
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
                return formatVector(list);
            }
        } catch (Exception ex) {
            log.debug("[AiChatController] Không thể tạo vector embedding cho câu hỏi: {}", ex.getMessage());
        }
        return null;
    }

    private List<Map<String, Object>> queryChunks(String sql, Object... args) {
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> item = new HashMap<>();
            item.put("source_path", rs.getString("source_path"));
            item.put("title", rs.getString("source_path"));
            item.put("content", rs.getString("content"));
            return item;
        }, args);
    }

    private List<Map<String, Object>> queryCodeEntities(String sql, Object... args) {
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> item = new HashMap<>();
            item.put("file_path", rs.getString("file_path"));
            item.put("signature", rs.getString("signature"));
            item.put("docstring", rs.getString("doc_status"));
            return item;
        }, args);
    }

    private void attachContext(Map<String, Object> payload,
                               List<Map<String, Object>> contextChunks,
                               List<Map<String, Object>> codeEntities) {
        if (!contextChunks.isEmpty()) {
            payload.put("context_chunks", contextChunks);
            payload.put("contextChunks", contextChunks);
        }
        if (!codeEntities.isEmpty()) {
            payload.put("code_entities", codeEntities);
            payload.put("codeEntities", codeEntities);
        }
    }

    private String firstToken(String message) {
        String[] tokens = message.split("\\s+");
        return tokens.length > 0 ? tokens[0] : message;
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
