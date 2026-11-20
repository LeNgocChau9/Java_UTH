package com.example.livingdocs_backend.infrastructure.ai;

import com.example.livingdocs_backend.application.service.AiRuntimeConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Client kết nối trực tiếp Google Gemini API Cloud (R10) từ Spring Boot backend.
 * Giải quyết triệt để tình huống môi trường Production (Render) không có FastAPI/Ollama chạy nội bộ (localhost:8000),
 * giúp toàn bộ tính năng Sinh tài liệu, Chatbot RAG, Soát sai lệch (Drift), Viết lại tài liệu (Rewrite)
 * hoạt động mượt mà với chùm API Key Gemini và cơ chế luân phiên Model thông minh.
 */
@Slf4j
@Component
public class GeminiDirectClient {

    private static final List<String> CANDIDATE_MODELS = List.of(
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash-lite",
            "gemini-3.6-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest"
    );

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final List<String> configuredKeys;
    private final AtomicInteger keyIndex = new AtomicInteger(0);

    @Autowired(required = false)
    private AiRuntimeConfigService aiRuntimeConfigService;

    public GeminiDirectClient(
            ObjectMapper objectMapper,
            @Value("${gemini.api-keys:}") String geminiApiKeys,
            @Value("${gemini.api-key:}") String geminiApiKey
    ) {
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        Set<String> keys = new LinkedHashSet<>();
        if (StringUtils.hasText(geminiApiKeys)) {
            for (String k : geminiApiKeys.split(",")) {
                if (StringUtils.hasText(k)) {
                    keys.add(k.trim());
                }
            }
        }
        if (StringUtils.hasText(geminiApiKey)) {
            for (String k : geminiApiKey.split(",")) {
                if (StringUtils.hasText(k)) {
                    keys.add(k.trim());
                }
            }
        }
        String envKey = System.getenv("GEMINI_API_KEY");
        if (StringUtils.hasText(envKey)) {
            for (String k : envKey.split(",")) {
                if (StringUtils.hasText(k)) {
                    keys.add(k.trim());
                }
            }
        }
        this.configuredKeys = new ArrayList<>(keys);
        log.info("[GeminiDirectClient] Khởi tạo thành công với {} Google Gemini API keys dự phòng", this.configuredKeys.size());
    }

    /**
     * Thu thập danh sách toàn bộ API Key khả dụng (tách biệt từng key từ DB và Environment).
     */
    public List<String> getAllAvailableKeys() {
        Set<String> keys = new LinkedHashSet<>();
        if (aiRuntimeConfigService != null) {
            try {
                var raw = aiRuntimeConfigService.getRawSettings();
                if (raw != null && StringUtils.hasText(raw.apiKey()) && !AiRuntimeConfigService.isMasked(raw.apiKey())) {
                    for (String k : raw.apiKey().split(",")) {
                        String clean = k.trim();
                        if (StringUtils.hasText(clean) && !AiRuntimeConfigService.isMasked(clean)) {
                            keys.add(clean);
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("[GeminiDirectClient] Không đọc được key từ AdminSettings: {}", e.getMessage());
            }
        }
        for (String k : configuredKeys) {
            if (StringUtils.hasText(k)) {
                keys.add(k.trim());
            }
        }
        return new ArrayList<>(keys);
    }

    /**
     * Lấy 1 API Key đơn lẻ đang hoạt động để gửi request.
     */
    public String getEffectiveApiKey() {
        List<String> keys = getAllAvailableKeys();
        if (keys.isEmpty()) {
            return "";
        }
        int idx = Math.abs(keyIndex.get() % keys.size());
        return keys.get(idx);
    }

    /**
     * Xoay sang API Key kế tiếp khi gặp lỗi quá hạn mức (HTTP 429) hoặc không xác thực (HTTP 401).
     */
    public void rotateKey() {
        List<String> keys = getAllAvailableKeys();
        if (!keys.isEmpty()) {
            int next = keyIndex.incrementAndGet();
            log.warn("[GeminiDirectClient] Xoay sang API Key kế tiếp (index: {}) do lỗi hạn mức hoặc xác thực", Math.abs(next % keys.size()));
        }
    }

    public boolean isAvailable() {
        return !getAllAvailableKeys().isEmpty();
    }

    /**
     * Gọi Google Gemini API để sinh nội dung văn bản tổng quát.
     * Tự động thử qua danh sách Candidate Models khi gặp 503 (bận) hoặc 404 (model cũ).
     */
    public Optional<String> callGemini(String systemPrompt, String userPrompt, Double temperature) {
        List<String> availableKeys = getAllAvailableKeys();
        if (availableKeys.isEmpty()) {
            log.warn("[GeminiDirectClient] Không có API Key Gemini khả dụng");
            return Optional.empty();
        }

        int maxKeyAttempts = Math.min(availableKeys.size(), 3);
        for (int keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
            String apiKey = getEffectiveApiKey();
            if (!StringUtils.hasText(apiKey)) {
                break;
            }

            for (String model : CANDIDATE_MODELS) {
                String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
                try {
                    Map<String, Object> bodyMap = new HashMap<>();
                    if (StringUtils.hasText(systemPrompt)) {
                        bodyMap.put("system_instruction", Map.of(
                                "parts", List.of(Map.of("text", systemPrompt))
                        ));
                    }
                    bodyMap.put("contents", List.of(
                            Map.of("parts", List.of(Map.of("text", userPrompt)))
                    ));
                    bodyMap.put("generationConfig", Map.of(
                            "temperature", temperature != null ? temperature : 0.3,
                            "maxOutputTokens", 8192
                    ));

                    String jsonPayload = objectMapper.writeValueAsString(bodyMap);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .timeout(Duration.ofSeconds(25))
                            .header("Content-Type", "application/json")
                            .header("x-goog-api-key", apiKey)
                            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    int status = response.statusCode();

                    if (status == 200) {
                        JsonNode root = objectMapper.readTree(response.body());
                        JsonNode candidates = root.path("candidates");
                        if (candidates.isArray() && !candidates.isEmpty()) {
                            JsonNode textNode = candidates.get(0).path("content").path("parts").get(0).path("text");
                            if (!textNode.isMissingNode() && StringUtils.hasText(textNode.asText())) {
                                log.info("[GeminiDirectClient] Gọi thành công Gemini Model: {} (ký tự trả về: {})", model, textNode.asText().length());
                                return Optional.of(textNode.asText());
                            }
                        }
                    } else if (status == 401 || status == 429) {
                        log.warn("[GeminiDirectClient] Key gặp lỗi HTTP {} trên model {}. Đang xoay key...", status, model);
                        rotateKey();
                        break; // Chuyển sang thử key kế tiếp ngay
                    } else if (status == 503 || status == 404) {
                        log.warn("[GeminiDirectClient] Model {} trả về HTTP {}. Chuyển sang model kế tiếp...", model, status);
                    } else {
                        log.warn("[GeminiDirectClient] Gemini API lỗi HTTP {}: {}", status, response.body());
                    }
                } catch (Exception e) {
                    log.warn("[GeminiDirectClient] Lỗi khi gọi Gemini model {}: {}", model, e.getMessage());
                }
            }
        }

        return Optional.empty();
    }

    /**
     * Sinh tài liệu kỹ thuật hoàn chỉnh dựa trên phân tích AST và mẫu tài liệu.
     */
    public Optional<String> generateTechnicalDoc(
            String templateType,
            String targetName,
            String filePath,
            String commitHash,
            List<?> entities,
            String sourceCode,
            String repoSummary
    ) {
        String entitiesJson = "";
        try {
            entitiesJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(entities != null ? entities : List.of());
        } catch (Exception ignored) {
        }

        String codeSnippet = "";
        if (StringUtils.hasText(sourceCode)) {
            codeSnippet = "\n### ĐOẠN MÃ NGUỒN THAM CHIẾU:\n```\n"
                    + (sourceCode.length() > 12000 ? sourceCode.substring(0, 12000) + "\n...[cắt bớt để tối ưu]" : sourceCode)
                    + "\n```\n";
        }

        String systemPrompt = "Bạn là Chuyên gia Kiến trúc Phần mềm và Senior Technical Writer cao cấp của hệ thống LivingDocs.\n"
                + "Nhiệm vụ của bạn là phân tích sâu sắc cấu trúc mã nguồn thực tế và viết tài liệu kỹ thuật chuyên nghiệp, chi tiết, đầy đủ bằng định dạng MARKDOWN tiếng Việt.\n"
                + "Tuyệt đối không viết tài liệu chung chung, không bịa đặt các thành phần không có trong mã nguồn.\n"
                + "Hãy tự động tạo các biểu đồ Mermaid trực quan (flowchart, sequenceDiagram, classDiagram) phù hợp với nghiệp vụ thực tế của repository này.";

        String userPrompt = "Hãy tạo tài liệu kỹ thuật hoàn chỉnh cho đối tượng sau:\n"
                + "- Tên thành phần: " + targetName + "\n"
                + "- Đường dẫn tệp: " + filePath + "\n"
                + "- Mã Commit: " + (commitHash != null ? commitHash : "HEAD") + "\n"
                + "- Mẫu tài liệu: " + templateType + "\n"
                + (StringUtils.hasText(repoSummary) ? "- Tổng quan Repository:\n" + repoSummary + "\n" : "")
                + "- Danh sách thực thể mã nguồn (Classes/Methods/Fields):\n" + entitiesJson + "\n"
                + codeSnippet + "\n\n"
                + "YÊU CẦU ĐẶC BIỆT:\n"
                + "1. Cấu trúc bài viết mạch lạc, sử dụng các tiêu đề (#, ##, ###), bảng tóm tắt API/Phương thức, tham số và giá trị trả về.\n"
                + "2. Vẽ biểu đồ Mermaid thực tế biểu diễn luồng hoạt động của thành phần này.\n"
                + "3. Hướng dẫn sử dụng và kiểm thử rõ ràng.\n"
                + "4. Chỉ trả về nội dung Markdown thuần túy (không bọc trong thẻ giải thích bên ngoài).";

        return callGemini(systemPrompt, userPrompt, 0.2);
    }

    /**
     * Hỗ trợ hỏi đáp thông minh (Chatbot Assistant) kết hợp ngữ cảnh RAG từ tài liệu và mã nguồn.
     */
    public Optional<String> answerChat(String userMessage, String ragContext) {
        String systemPrompt = "Bạn là Trợ lý AI Thông minh của nền tảng LivingDocs (AI Documentation Platform).\n"
                + "Bạn am hiểu sâu sắc về kiến trúc phần mềm, quy trình Living Documentation, phân tích AST, kiểm soát sai lệch tài liệu (Drift Detection), và các công nghệ Java, TypeScript, Next.js, Spring Boot.\n"
                + "Hãy trả lời người dùng một cách thân thiện, chính xác, ngắn gọn nhưng đầy đủ chuyên môn bằng tiếng Việt có định dạng Markdown đẹp mắt.";

        String userPrompt = userMessage;
        if (StringUtils.hasText(ragContext)) {
            userPrompt = "Dưới đây là ngữ cảnh liên quan từ kho tài liệu và mã nguồn của dự án:\n"
                    + "```\n" + ragContext + "\n```\n\n"
                    + "Câu hỏi của người dùng: " + userMessage;
        }

        return callGemini(systemPrompt, userPrompt, 0.4);
    }

    /**
     * Tự động viết lại mục tài liệu bị tác động bởi thay đổi mã nguồn (Auto-Draft on Drift).
     */
    public Optional<String> rewriteDocSnippet(String currentDoc, String codeDiff, String entityName) {
        String systemPrompt = "Bạn là Senior Technical Writer chuyên về tài liệu sống (Living Documentation).\n"
                + "Nhiệm vụ của bạn là phân tích đoạn code diff (thay đổi mã nguồn) và cập nhật lại bản thảo tài liệu kỹ thuật hiện tại sao cho phản ánh chính xác nhất logic mới, giữ nguyên định dạng Markdown và phong cách của tài liệu ban đầu.";

        String userPrompt = "Tài liệu hiện tại:\n```markdown\n" + currentDoc + "\n```\n\n"
                + "Mã nguồn thay đổi (Code Diff):\n```diff\n" + codeDiff + "\n```\n\n"
                + "Hãy phân tích thay đổi của thành phần '" + entityName + "' và cập nhật lại toàn bộ tài liệu Markdown hoàn chỉnh phản ánh đúng logic mới.";

        return callGemini(systemPrompt, userPrompt, 0.2);
    }
}
