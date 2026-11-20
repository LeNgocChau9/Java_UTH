package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
public class DetailedHealthService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final JdbcTemplate jdbcTemplate;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final AuditLogRepositoryPort auditLogRepositoryPort;
    private final String aiEngineUrl;
    private final RestClient aiEngineClient;
    private final RestClient githubClient;

    public DetailedHealthService(
            JdbcTemplate jdbcTemplate,
            SpringDataGitHubConnectionRepository gitHubConnectionRepository,
            AuditLogRepositoryPort auditLogRepositoryPort,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl) {
        this.jdbcTemplate = jdbcTemplate;
        this.gitHubConnectionRepository = gitHubConnectionRepository;
        this.auditLogRepositoryPort = auditLogRepositoryPort;
        this.aiEngineUrl = aiEngineUrl;

        SimpleClientHttpRequestFactory aiFactory = new SimpleClientHttpRequestFactory();
        aiFactory.setConnectTimeout(3000);
        aiFactory.setReadTimeout(4000);
        this.aiEngineClient = RestClient.builder()
                .baseUrl(aiEngineUrl)
                .requestFactory(aiFactory)
                .build();

        SimpleClientHttpRequestFactory ghFactory = new SimpleClientHttpRequestFactory();
        ghFactory.setConnectTimeout(3000);
        ghFactory.setReadTimeout(5000);
        this.githubClient = RestClient.builder()
                .baseUrl("https://api.github.com")
                .requestFactory(ghFactory)
                .build();
    }

    public Map<String, Object> collectDetailedHealth() {
        long startTotal = System.nanoTime();

        Map<String, Object> postgres = checkPostgres();
        Map<String, Object> github = checkGitHubRateLimit();
        Map<String, Object> aiEngine = checkAiEngine();
        List<Map<String, Object>> recentAuditLogs = fetchRecentAuditLogs();

        long totalElapsedMs = Math.max(1L, (System.nanoTime() - startTotal) / 1_000_000L);

        boolean pgUp = "UP".equals(postgres.get("status"));
        boolean aiUp = "UP".equals(aiEngine.get("status"));
        boolean ghUp = "UP".equals(github.get("status"));

        String overallStatus;
        if (!pgUp) {
            overallStatus = "DOWN";
        } else if (!aiUp || !ghUp) {
            overallStatus = "DEGRADED";
        } else {
            overallStatus = "UP";
        }

        Map<String, Object> backend = new LinkedHashMap<>();
        backend.put("status", "UP");
        backend.put("service", "livingdocs-backend");
        backend.put("version", "v1.0.0");
        backend.put("port", 8080);
        backend.put("latencyMs", totalElapsedMs);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", overallStatus);
        result.put("service", "livingdocs-backend");
        result.put("version", "v1.0.0");
        result.put("timestamp", Instant.now().toString());
        result.put("backend", backend);
        result.put("postgres", postgres);
        result.put("github", github);
        result.put("aiEngine", aiEngine);
        result.put("recentAuditLogs", recentAuditLogs);
        return result;
    }

    private Map<String, Object> checkPostgres() {
        Map<String, Object> pg = new LinkedHashMap<>();
        long start = System.nanoTime();
        try {
            Integer ping = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            long latencyMs = Math.max(0L, (System.nanoTime() - start) / 1_000_000L);

            boolean pgvectorInstalled = false;
            String pgvectorVersion = null;
            List<Map<String, Object>> extRows = jdbcTemplate.queryForList(
                    "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
            );
            if (!extRows.isEmpty()) {
                pgvectorInstalled = true;
                Object ver = extRows.get(0).get("extversion");
                pgvectorVersion = ver != null ? String.valueOf(ver) : null;
            }

            pg.put("status", (ping != null && ping == 1) ? "UP" : "DOWN");
            pg.put("latencyMs", latencyMs);
            pg.put("pgvectorInstalled", pgvectorInstalled);
            pg.put("pgvectorVersion", pgvectorVersion);
            pg.put("error", null);
        } catch (Exception ex) {
            long latencyMs = Math.max(0L, (System.nanoTime() - start) / 1_000_000L);
            log.warn("[DetailedHealthService] PostgreSQL health check failed: {}", ex.getMessage());
            pg.put("status", "DOWN");
            pg.put("latencyMs", latencyMs);
            pg.put("pgvectorInstalled", false);
            pg.put("pgvectorVersion", null);
            pg.put("error", ex.getMessage());
        }
        return pg;
    }

    private Map<String, Object> checkGitHubRateLimit() {
        Map<String, Object> gh = new LinkedHashMap<>();
        String token = findUsableGitHubToken();
        boolean hasToken = StringUtils.hasText(token);

        long start = System.nanoTime();
        try {
            Map<String, Object> body = queryGitHubRateLimit(token);
            long latencyMs = Math.max(0L, (System.nanoTime() - start) / 1_000_000L);
            populateGitHubRateLimit(gh, body, hasToken, latencyMs, null);
        } catch (Exception ex) {
            // Nếu token lưu trong DB bị hết hạn/revoked (401), thử lại nặc danh để không làm hỏng telemetry
            if (hasToken) {
                try {
                    long retryStart = System.nanoTime();
                    Map<String, Object> anonBody = queryGitHubRateLimit(null);
                    long latencyMs = Math.max(0L, (System.nanoTime() - retryStart) / 1_000_000L);
                    populateGitHubRateLimit(gh, anonBody, false, latencyMs,
                            "Token GitHub đã lưu không hợp lệ, đang dùng chế độ nặc danh: " + ex.getMessage());
                    return gh;
                } catch (Exception fallbackEx) {
                    log.warn("[DetailedHealthService] GitHub anonymous rate-limit fallback failed: {}", fallbackEx.getMessage());
                }
            }
            long latencyMs = Math.max(0L, (System.nanoTime() - start) / 1_000_000L);
            log.warn("[DetailedHealthService] GitHub rate-limit check failed: {}", ex.getMessage());
            gh.put("status", "OFFLINE");
            gh.put("authenticated", hasToken);
            gh.put("latencyMs", latencyMs);
            gh.put("limit", null);
            gh.put("remaining", null);
            gh.put("used", null);
            gh.put("reset", null);
            gh.put("resetAt", null);
            gh.put("error", ex.getMessage());
        }
        return gh;
    }

    private Map<String, Object> queryGitHubRateLimit(String token) {
        RestClient.RequestHeadersSpec<?> req = githubClient.get()
                .uri("/rate_limit")
                .accept(MediaType.APPLICATION_JSON)
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("User-Agent", "LivingDocs-Telemetry");

        if (StringUtils.hasText(token)) {
            req = req.header("Authorization", "Bearer " + token.trim());
        }

        return req.retrieve().body(MAP_TYPE);
    }

    @SuppressWarnings("unchecked")
    private void populateGitHubRateLimit(
            Map<String, Object> target,
            Map<String, Object> body,
            boolean authenticated,
            long latencyMs,
            String warning) {
        Integer limit = null;
        Integer remaining = null;
        Integer used = null;
        Long reset = null;
        String resetAt = null;

        if (body != null && body.get("resources") instanceof Map<?, ?> resources) {
            Object coreObj = resources.get("core");
            if (coreObj instanceof Map<?, ?> core) {
                limit = toInteger(core.get("limit"));
                remaining = toInteger(core.get("remaining"));
                used = toInteger(core.get("used"));
                reset = toLong(core.get("reset"));
                if (reset != null && reset > 0) {
                    resetAt = Instant.ofEpochSecond(reset).toString();
                }
            }
        }

        target.put("status", "UP");
        target.put("authenticated", authenticated);
        target.put("latencyMs", latencyMs);
        target.put("limit", limit);
        target.put("remaining", remaining);
        target.put("used", used);
        target.put("reset", reset);
        target.put("resetAt", resetAt);
        target.put("error", warning);
    }

    private String findUsableGitHubToken() {
        try {
            List<GitHubConnectionEntity> connected = gitHubConnectionRepository.findAllByStatus("CONNECTED");
            for (GitHubConnectionEntity conn : connected) {
                String rawToken = conn.getAccessTokenEncrypted();
                String token = rawToken != null ? rawToken.trim() : null;
                if (StringUtils.hasText(token)
                        && !"DUMMY_TOKEN".equals(token)
                        && !"placeholder".equalsIgnoreCase(token)
                        && !token.startsWith("enc:v1:")) {
                    return token;
                }
            }
        } catch (Exception ex) {
            log.debug("[DetailedHealthService] Could not query github_connections: {}", ex.getMessage());
        }
        return null;
    }

    private Map<String, Object> checkAiEngine() {
        Map<String, Object> ai = new LinkedHashMap<>();
        long start = System.nanoTime();
        try {
            Map<String, Object> providers = aiEngineClient.get()
                    .uri("/v1/ai/providers")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(MAP_TYPE);

            Map<String, Object> quotaMetrics = null;
            try {
                quotaMetrics = aiEngineClient.get()
                        .uri("/v1/quota/metrics")
                        .accept(MediaType.APPLICATION_JSON)
                        .retrieve()
                        .body(MAP_TYPE);
            } catch (Exception qEx) {
                log.warn("[DetailedHealthService] /v1/quota/metrics failed while /v1/ai/providers succeeded: {}", qEx.getMessage());
            }

            long latencyMs = Math.max(0L, (System.nanoTime() - start) / 1_000_000L);
            ai.put("status", "UP");
            ai.put("url", aiEngineUrl);
            ai.put("latencyMs", latencyMs);
            ai.put("message", "AI Engine đang hoạt động bình thường");
            ai.put("providers", providers);
            ai.put("quotaMetrics", quotaMetrics);
            ai.put("error", null);
        } catch (Exception ex) {
            long latencyMs = Math.max(0L, (System.nanoTime() - start) / 1_000_000L);
            log.warn("[DetailedHealthService] AI Engine offline at {}: {}", aiEngineUrl, ex.getMessage());
            ai.put("status", "OFFLINE");
            ai.put("url", aiEngineUrl);
            ai.put("latencyMs", latencyMs);
            ai.put("message", "AI Engine chưa khởi động hoặc không phản hồi tại " + aiEngineUrl
                    + ". Vui lòng bật FastAPI server (uvicorn app.main:app --port 8000).");
            ai.put("providers", null);
            ai.put("quotaMetrics", null);
            ai.put("error", ex.getMessage());
        }
        return ai;
    }

    private List<Map<String, Object>> fetchRecentAuditLogs() {
        try {
            List<AuditLog> logs = auditLogRepositoryPort.findRecent();
            if (logs == null || logs.isEmpty()) {
                return Collections.emptyList();
            }
            return logs.stream()
                    .limit(10)
                    .map(entry -> {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("logId", entry.getLogId());
                        row.put("actorId", entry.getActorId());
                        row.put("action", entry.getAction() != null ? entry.getAction().name() : null);
                        row.put("resourceType", entry.getResourceType());
                        row.put("resourceId", entry.getResourceId());
                        row.put("detail", entry.getDetail());
                        row.put("createdAt", entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null);
                        return row;
                    })
                    .toList();
        } catch (Exception ex) {
            log.warn("[DetailedHealthService] Failed to fetch recent audit logs: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private static Integer toInteger(Object val) {
        if (val instanceof Number num) {
            return num.intValue();
        }
        if (val != null) {
            try {
                return Integer.parseInt(val.toString());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static Long toLong(Object val) {
        if (val instanceof Number num) {
            return num.longValue();
        }
        if (val != null) {
            try {
                return Long.parseLong(val.toString());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
