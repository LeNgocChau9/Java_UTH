package com.example.livingdocs_backend.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service tải nội dung tài liệu thực tế từ nền tảng ngoài qua java.net.http.HttpClient:
 * - GitHub Raw (raw.githubusercontent.com hoặc chuyển đổi tự động từ github.com/.../blob/...)
 * - Google Docs Public (export?format=txt)
 * - Notion (Blocks API v1 hoặc trang public)
 * - Confluence REST API (/wiki/rest/api/content/{id}?expand=body.storage hoặc trang HTML)
 */
@Slf4j
@Service
public class ExternalDocumentFetchService {

    private static final Pattern GITHUB_BLOB_PATTERN = Pattern.compile(
            "^https?://github\\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern GOOGLE_DOCS_ID_PATTERN = Pattern.compile(
            "docs\\.google\\.com/document/d/([a-zA-Z0-9_-]+)"
    );

    private static final Pattern CONFLUENCE_PAGE_ID_PATH_PATTERN = Pattern.compile(
            "/pages/(\\d+)"
    );

    private static final Pattern CONFLUENCE_PAGE_ID_QUERY_PATTERN = Pattern.compile(
            "[?&]pageId=(\\d+)"
    );

    private static final Pattern NOTION_ID_PATTERN = Pattern.compile(
            "([0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\\?.*)?$"
    );

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final ExternalIntegrationService integrationService;

    @Autowired
    public ExternalDocumentFetchService(
            ObjectMapper objectMapper,
            @Autowired(required = false) ExternalIntegrationService integrationService) {
        this(
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .followRedirects(HttpClient.Redirect.NORMAL)
                        .build(),
                objectMapper,
                integrationService
        );
    }

    public ExternalDocumentFetchService(
            HttpClient httpClient,
            ObjectMapper objectMapper,
            ExternalIntegrationService integrationService) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.integrationService = integrationService;
    }

    public String fetchContent(String sourceType, String sourceUrlOrId) {
        if (!StringUtils.hasText(sourceUrlOrId)) {
            throw new IllegalArgumentException("URL hoặc ID tài liệu nguồn không được để trống");
        }
        String type = StringUtils.hasText(sourceType)
                ? sourceType.trim().toUpperCase(Locale.ROOT)
                : "MARKDOWN";
        String input = sourceUrlOrId.trim();

        return switch (type) {
            case "GITHUB_RAW", "GITHUB", "MARKDOWN" -> fetchGitHubRaw(input);
            case "GOOGLE_DOCS" -> fetchGoogleDocsPublic(input);
            case "NOTION" -> fetchNotion(input);
            case "CONFLUENCE" -> fetchConfluence(input);
            case "JIRA" -> fetchJira(input);
            default -> fetchGenericUrl(input, type);
        };
    }

    public String fetchGitHubRaw(String url) {
        String rawUrl = convertGitHubBlobToRaw(url);
        HttpResponse<String> response = executeGet(rawUrl, Map.of(
                "Accept", "text/plain, text/markdown, */*",
                "User-Agent", "LivingDocs-MCP-Importer/1.0"
        ));
        ensureSuccess(response, "GitHub Raw", rawUrl);
        String body = response.body();
        if (!StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Nội dung từ GitHub Raw rỗng: " + rawUrl);
        }
        return body;
    }

    public String convertGitHubBlobToRaw(String url) {
        String trimmed = url.trim();
        Matcher matcher = GITHUB_BLOB_PATTERN.matcher(trimmed);
        if (matcher.matches()) {
            return String.format("https://raw.githubusercontent.com/%s/%s/%s/%s",
                    matcher.group(1), matcher.group(2), matcher.group(3), matcher.group(4));
        }
        return trimmed;
    }

    public String fetchGoogleDocsPublic(String urlOrId) {
        String exportUrl = resolveGoogleDocsExportUrl(urlOrId);
        HttpResponse<String> response = executeGet(exportUrl, Map.of(
                "Accept", "text/plain, */*",
                "User-Agent", "LivingDocs-MCP-Importer/1.0"
        ));
        if (response.statusCode() == 401 || response.statusCode() == 403) {
            throw new IllegalArgumentException(
                    "Không thể truy cập Google Docs (HTTP " + response.statusCode() + "). " +
                    "Vui lòng bật chia sẻ công khai 'Bất kỳ ai có đường liên kết đều có thể xem'."
            );
        }
        ensureSuccess(response, "Google Docs", exportUrl);
        String body = response.body();
        if (!StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Tài liệu Google Docs không có nội dung văn bản.");
        }
        String lower = body.toLowerCase(Locale.ROOT);
        if (lower.contains("<html") && (lower.contains("accounts.google.com") || lower.contains("servicelogin"))) {
            throw new IllegalArgumentException(
                    "Google Docs yêu cầu đăng nhập. Vui lòng chuyển quyền chia sẻ sang 'Bất kỳ ai có đường liên kết đều có thể xem'."
            );
        }
        return body.strip();
    }

    public String resolveGoogleDocsExportUrl(String urlOrId) {
        String trimmed = urlOrId.trim();
        if (trimmed.contains("/export?")) {
            return trimmed;
        }
        Matcher m = GOOGLE_DOCS_ID_PATTERN.matcher(trimmed);
        if (m.find()) {
            return "https://docs.google.com/document/d/" + m.group(1) + "/export?format=txt";
        }
        if (trimmed.matches("^[a-zA-Z0-9_-]{10,}$")) {
            return "https://docs.google.com/document/d/" + trimmed + "/export?format=txt";
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        throw new IllegalArgumentException("Không trích xuất được Google Docs Document ID từ: " + trimmed);
    }

    public String fetchNotion(String urlOrId) {
        String trimmed = urlOrId.trim();
        Map<String, Object> notionCfg = getIntegrationConfig("NOTION");
        String apiToken = asString(notionCfg.get("apiToken"));
        if (!StringUtils.hasText(apiToken)) {
            apiToken = asString(notionCfg.get("secret"));
        }

        String pageId = extractNotionPageId(trimmed);

        // Nếu có Notion Integration Token và trích xuất được pageId (hoặc URL trỏ vào API mock/test), ưu tiên dùng Notion Blocks API
        if (StringUtils.hasText(apiToken) && StringUtils.hasText(pageId) && !trimmed.startsWith("http://localhost") && !trimmed.startsWith("http://127.0.0.1")) {
            String apiUrl = "https://api.notion.com/v1/blocks/" + formatNotionUuid(pageId) + "/children?page_size=100";
            HttpResponse<String> response = executeGet(apiUrl, Map.of(
                    "Authorization", "Bearer " + apiToken,
                    "Notion-Version", "2022-06-28",
                    "Accept", "application/json"
            ));
            ensureSuccess(response, "Notion API", apiUrl);
            return convertNotionBlocksJsonToMarkdown(response.body());
        }

        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            throw new IllegalArgumentException(
                    "Chưa cấu hình Notion API Token trong Cài đặt Tích hợp ngoài, hoặc vui lòng nhập đầy đủ URL công khai của trang Notion."
            );
        }

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", "application/json, text/markdown, text/html, text/plain");
        headers.put("User-Agent", "LivingDocs-MCP-Importer/1.0");
        if (StringUtils.hasText(apiToken)) {
            headers.put("Authorization", "Bearer " + apiToken);
            headers.put("Notion-Version", "2022-06-28");
        }

        HttpResponse<String> response = executeGet(trimmed, headers);
        ensureSuccess(response, "Notion", trimmed);
        String body = response.body();
        if (!StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Phản hồi từ Notion rỗng.");
        }
        String trimmedBody = body.trim();
        if (trimmedBody.startsWith("{")) {
            return convertNotionBlocksJsonToMarkdown(trimmedBody);
        }
        if (trimmedBody.toLowerCase(Locale.ROOT).contains("<html")) {
            return htmlToMarkdown(trimmedBody);
        }
        return trimmedBody;
    }

    public String fetchConfluence(String urlOrId) {
        String trimmed = urlOrId.trim();
        Map<String, Object> confluenceCfg = getIntegrationConfig("CONFLUENCE");
        String apiBaseUrl = asString(confluenceCfg.get("apiBaseUrl"));
        String apiToken = asString(confluenceCfg.get("apiToken"));
        if (!StringUtils.hasText(apiToken)) {
            apiToken = asString(confluenceCfg.get("secret"));
        }

        String targetUrl = resolveConfluenceApiUrl(trimmed, apiBaseUrl);

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", "application/json, text/plain, text/html");
        headers.put("User-Agent", "LivingDocs-MCP-Importer/1.0");
        if (StringUtils.hasText(apiToken)) {
            if (apiToken.contains(":") && !apiToken.startsWith("Basic ") && !apiToken.startsWith("Bearer ")) {
                String encoded = Base64.getEncoder().encodeToString(apiToken.getBytes(StandardCharsets.UTF_8));
                headers.put("Authorization", "Basic " + encoded);
            } else if (!apiToken.startsWith("Basic ") && !apiToken.startsWith("Bearer ")) {
                headers.put("Authorization", "Bearer " + apiToken);
            } else {
                headers.put("Authorization", apiToken);
            }
        }

        HttpResponse<String> response = executeGet(targetUrl, headers);
        ensureSuccess(response, "Confluence", targetUrl);
        String body = response.body();
        if (!StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Nội dung trả về từ Confluence rỗng.");
        }

        String trimmedBody = body.trim();
        if (trimmedBody.startsWith("{")) {
            return parseConfluenceJsonToMarkdown(trimmedBody);
        }
        if (trimmedBody.toLowerCase(Locale.ROOT).contains("<html")) {
            return htmlToMarkdown(trimmedBody);
        }
        return trimmedBody;
    }

    public String resolveConfluenceApiUrl(String urlOrId, String configuredBaseUrl) {
        if (urlOrId.contains("/rest/api/content/")) {
            return urlOrId;
        }
        if (urlOrId.startsWith("http://") || urlOrId.startsWith("https://")) {
            URI uri = URI.create(urlOrId);
            String pageId = extractConfluencePageId(urlOrId);
            if (StringUtils.hasText(pageId) && (urlOrId.contains("/wiki/") || urlOrId.contains("viewpage.action"))) {
                String origin = uri.getScheme() + "://" + uri.getAuthority();
                String prefix = urlOrId.contains("/wiki/") ? "/wiki" : "";
                return origin + prefix + "/rest/api/content/" + pageId + "?expand=body.storage,version";
            }
            return urlOrId;
        }
        // Người dùng chỉ truyền Page ID (vd: "123456")
        if (StringUtils.hasText(configuredBaseUrl)) {
            String base = configuredBaseUrl.replaceAll("/+$", "");
            return base + "/rest/api/content/" + urlOrId + "?expand=body.storage,version";
        }
        throw new IllegalArgumentException(
                "Vui lòng nhập URL Confluence đầy đủ hoặc cấu hình apiBaseUrl cho CONFLUENCE trong Cài đặt tích hợp."
        );
    }

    private String fetchJira(String urlOrId) {
        String trimmed = urlOrId.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return fetchGenericUrl(trimmed, "Jira");
        }
        Map<String, Object> jiraCfg = getIntegrationConfig("JIRA");
        String baseUrl = asString(jiraCfg.get("apiBaseUrl"));
        String token = asString(jiraCfg.get("apiToken"));
        if (!StringUtils.hasText(baseUrl)) {
            throw new IllegalArgumentException(
                    "Vui lòng nhập URL đầy đủ của Jira Issue hoặc cấu hình JIRA Base URL trong tích hợp ngoài."
            );
        }
        String apiUrl = baseUrl.replaceAll("/+$", "") + "/rest/api/3/issue/" + trimmed;
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", "application/json");
        if (StringUtils.hasText(token)) {
            headers.put("Authorization", token.startsWith("Bearer ") || token.startsWith("Basic ") ? token : "Bearer " + token);
        }
        HttpResponse<String> response = executeGet(apiUrl, headers);
        ensureSuccess(response, "Jira", apiUrl);
        return parseJiraIssueJson(response.body(), trimmed);
    }

    private String fetchGenericUrl(String url, String label) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new IllegalArgumentException("Nguồn " + label + " yêu cầu URL http:// hoặc https:// hợp lệ.");
        }
        HttpResponse<String> response = executeGet(url, Map.of(
                "Accept", "text/markdown, text/plain, application/json, text/html",
                "User-Agent", "LivingDocs-MCP-Importer/1.0"
        ));
        ensureSuccess(response, label, url);
        String body = response.body();
        if (!StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Nội dung tải từ " + label + " bị rỗng.");
        }
        if (body.trim().toLowerCase(Locale.ROOT).contains("<html")) {
            return htmlToMarkdown(body);
        }
        return body.trim();
    }

    public String parseConfluenceJsonToMarkdown(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            String title = root.path("title").asText("");
            String storageHtml = root.path("body").path("storage").path("value").asText("");
            if (!StringUtils.hasText(storageHtml)) {
                storageHtml = root.path("body").path("view").path("value").asText("");
            }
            if (!StringUtils.hasText(storageHtml)) {
                throw new IllegalArgumentException("Confluence API không trả về trường body.storage.value");
            }
            String mdBody = htmlToMarkdown(storageHtml);
            if (StringUtils.hasText(title) && !mdBody.startsWith("# ")) {
                return "# " + title + "\n\n" + mdBody;
            }
            return mdBody;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Không thể phân tích JSON từ Confluence: " + ex.getMessage(), ex);
        }
    }

    public String convertNotionBlocksJsonToMarkdown(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode results = root.has("results") ? root.path("results") : root.path("blocks");
            if (!results.isArray() || results.isEmpty()) {
                // Nếu là Page object có properties.title
                String pageTitle = extractNotionRichText(root.path("properties").path("title").path("title"));
                if (StringUtils.hasText(pageTitle)) {
                    return "# " + pageTitle;
                }
                throw new IllegalArgumentException("Không tìm thấy nội dung blocks trong phản hồi Notion.");
            }
            StringBuilder sb = new StringBuilder();
            for (JsonNode block : results) {
                String type = block.path("type").asText("");
                JsonNode blockNode = block.path(type);
                String text = extractNotionRichText(blockNode.path("rich_text"));
                if (!StringUtils.hasText(text)) {
                    text = extractNotionRichText(blockNode.path("text"));
                }
                switch (type) {
                    case "heading_1" -> sb.append("# ").append(text).append("\n\n");
                    case "heading_2" -> sb.append("## ").append(text).append("\n\n");
                    case "heading_3" -> sb.append("### ").append(text).append("\n\n");
                    case "bulleted_list_item" -> sb.append("- ").append(text).append("\n");
                    case "numbered_list_item" -> sb.append("1. ").append(text).append("\n");
                    case "to_do" -> {
                        boolean checked = blockNode.path("checked").asBoolean(false);
                        sb.append(checked ? "- [x] " : "- [ ] ").append(text).append("\n");
                    }
                    case "code" -> {
                        String lang = blockNode.path("language").asText("");
                        sb.append("```").append(lang).append("\n").append(text).append("\n```\n\n");
                    }
                    case "quote" -> sb.append("> ").append(text).append("\n\n");
                    case "divider" -> sb.append("---\n\n");
                    default -> {
                        if (StringUtils.hasText(text)) {
                            sb.append(text).append("\n\n");
                        }
                    }
                }
            }
            String result = sb.toString().trim();
            if (!StringUtils.hasText(result)) {
                throw new IllegalArgumentException("Trang Notion không có khối văn bản nào để đồng bộ.");
            }
            return result;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Không thể phân tích JSON từ Notion: " + ex.getMessage(), ex);
        }
    }

    private String extractNotionRichText(JsonNode arrayNode) {
        if (arrayNode == null || !arrayNode.isArray()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode item : arrayNode) {
            String plain = item.path("plain_text").asText("");
            if (!StringUtils.hasText(plain)) {
                plain = item.path("text").path("content").asText("");
            }
            sb.append(plain);
        }
        return sb.toString();
    }

    private String parseJiraIssueJson(String json, String key) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode fields = root.path("fields");
            String summary = fields.path("summary").asText(key);
            String desc = fields.path("description").asText("");
            String status = fields.path("status").path("name").asText("");
            StringBuilder sb = new StringBuilder();
            sb.append("# ").append(key).append(": ").append(summary).append("\n\n");
            if (StringUtils.hasText(status)) {
                sb.append("**Trạng thái:** ").append(status).append("\n\n");
            }
            if (StringUtils.hasText(desc)) {
                sb.append(desc);
            }
            return sb.toString().trim();
        } catch (Exception ex) {
            return json;
        }
    }

    public String htmlToMarkdown(String html) {
        if (!StringUtils.hasText(html)) {
            return "";
        }
        String text = html
                .replaceAll("(?is)<script[^>]*>.*?</script>", "")
                .replaceAll("(?is)<style[^>]*>.*?</style>", "")
                .replaceAll("(?i)<h1[^>]*>", "\n# ")
                .replaceAll("(?i)</h1>", "\n\n")
                .replaceAll("(?i)<h2[^>]*>", "\n## ")
                .replaceAll("(?i)</h2>", "\n\n")
                .replaceAll("(?i)<h3[^>]*>", "\n### ")
                .replaceAll("(?i)</h3>", "\n\n")
                .replaceAll("(?i)<h[4-6][^>]*>", "\n#### ")
                .replaceAll("(?i)</h[4-6]>", "\n\n")
                .replaceAll("(?i)<pre[^>]*>", "\n```\n")
                .replaceAll("(?i)</pre>", "\n```\n")
                .replaceAll("(?i)<code[^>]*>", "`")
                .replaceAll("(?i)</code>", "`")
                .replaceAll("(?i)<li[^>]*>", "\n- ")
                .replaceAll("(?i)</li>", "")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</p>", "\n\n")
                .replaceAll("(?i)<p[^>]*>", "")
                .replaceAll("(?s)<[^>]+>", "")
                .replace("&nbsp;", " ")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replaceAll("\n{3,}", "\n\n");
        return text.trim();
    }

    private HttpResponse<String> executeGet(String url, Map<String, String> headers) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                throw new IllegalArgumentException("URL không hợp lệ (chỉ hỗ trợ http/https): " + url);
            }
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofSeconds(15))
                    .GET();
            if (headers != null) {
                headers.forEach(builder::header);
            }
            return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[ExternalDocumentFetchService] Lỗi HTTP GET {}: {}", url, ex.getMessage());
            throw new IllegalArgumentException("Không thể kết nối tải tài liệu từ " + url + ": " + ex.getMessage(), ex);
        }
    }

    private void ensureSuccess(HttpResponse<String> response, String providerLabel, String url) {
        int code = response.statusCode();
        if (code < 200 || code >= 300) {
            throw new IllegalArgumentException(
                    String.format("Tải tài liệu từ %s thất bại (HTTP %d) tại %s", providerLabel, code, url)
            );
        }
    }

    private String extractConfluencePageId(String url) {
        Matcher pathMatcher = CONFLUENCE_PAGE_ID_PATH_PATTERN.matcher(url);
        if (pathMatcher.find()) {
            return pathMatcher.group(1);
        }
        Matcher queryMatcher = CONFLUENCE_PAGE_ID_QUERY_PATTERN.matcher(url);
        if (queryMatcher.find()) {
            return queryMatcher.group(1);
        }
        return null;
    }

    private String extractNotionPageId(String urlOrId) {
        Matcher m = NOTION_ID_PATTERN.matcher(urlOrId.trim());
        if (m.find()) {
            return m.group(1).replace("-", "");
        }
        return null;
    }

    private String formatNotionUuid(String id32) {
        String clean = id32.replace("-", "");
        if (clean.length() != 32) {
            return id32;
        }
        return clean.substring(0, 8) + "-" + clean.substring(8, 12) + "-" +
                clean.substring(12, 16) + "-" + clean.substring(16, 20) + "-" + clean.substring(20);
    }

    private Map<String, Object> getIntegrationConfig(String provider) {
        if (integrationService == null) {
            return Collections.emptyMap();
        }
        try {
            return integrationService.getRawConfig(provider, ExternalIntegrationService.DEFAULT_WORKSPACE_ID);
        } catch (Exception ex) {
            return Collections.emptyMap();
        }
    }

    private String asString(Object val) {
        return val != null ? val.toString().trim() : null;
    }
}
