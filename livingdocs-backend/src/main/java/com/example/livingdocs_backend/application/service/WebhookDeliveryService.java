package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.WebhookDeliveryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataWebhookDeliveryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookDeliveryService {

    private final SpringDataWebhookDeliveryRepository deliveryRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void ensureTableExists() {
        if (jdbcTemplate == null) {
            return;
        }
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
                    id bigserial NOT NULL,
                    delivery_id character varying(128),
                    event_type character varying(64) NOT NULL,
                    repository_id bigint,
                    repo_full_name character varying(255),
                    status character varying(32) NOT NULL,
                    http_status integer NOT NULL DEFAULT 200,
                    latency_ms bigint,
                    payload_summary text,
                    error_message text,
                    delivered_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id)
                );
                CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_repo_time
                    ON public.webhook_deliveries(repository_id, delivered_at DESC);
                CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at
                    ON public.webhook_deliveries(delivered_at DESC);
                """);
        } catch (Exception ex) {
            log.warn("[WebhookDeliveryService] Không thể tự động khởi tạo bảng webhook_deliveries: {}", ex.getMessage());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public WebhookDeliveryEntity recordDelivery(
            String deliveryId,
            String eventType,
            String repoFullName,
            String status,
            int httpStatus,
            long latencyMs,
            String rawPayload,
            String errorMessage) {
        try {
            String resolvedRepoFullName = repoFullName;
            Long resolvedRepoId = null;

            if (!StringUtils.hasText(resolvedRepoFullName) && StringUtils.hasText(rawPayload)) {
                resolvedRepoFullName = extractRepoFullName(rawPayload);
            }

            if (StringUtils.hasText(resolvedRepoFullName) && repositoryRepository != null) {
                Optional<RepositoryEntity> byName = repositoryRepository.findByWorkspaceIdAndRepoFullName(1L, resolvedRepoFullName);
                if (byName.isPresent()) {
                    resolvedRepoId = byName.get().getRepositoryId();
                } else {
                    final String target = resolvedRepoFullName;
                    resolvedRepoId = repositoryRepository.findAll().stream()
                            .filter(r -> target.equalsIgnoreCase(r.getRepoFullName()))
                            .map(RepositoryEntity::getRepositoryId)
                            .findFirst()
                            .orElse(null);
                }
            }

            if (resolvedRepoId == null && StringUtils.hasText(rawPayload)) {
                Long ghRepoId = extractGithubRepoId(rawPayload);
                if (ghRepoId != null && repositoryRepository != null) {
                    resolvedRepoId = repositoryRepository.findByWorkspaceIdAndGithubRepoId(1L, ghRepoId)
                            .map(RepositoryEntity::getRepositoryId)
                            .orElse(null);
                }
            }

            String summary = buildPayloadSummary(eventType, rawPayload);

            WebhookDeliveryEntity entity = WebhookDeliveryEntity.builder()
                    .deliveryId(StringUtils.hasText(deliveryId) ? deliveryId.trim() : null)
                    .eventType(StringUtils.hasText(eventType) ? eventType.trim() : "unknown")
                    .repositoryId(resolvedRepoId)
                    .repoFullName(resolvedRepoFullName)
                    .status(status)
                    .httpStatus(httpStatus)
                    .latencyMs(latencyMs)
                    .payloadSummary(summary)
                    .errorMessage(errorMessage)
                    .deliveredAt(Instant.now())
                    .build();

            return deliveryRepository.save(entity);
        } catch (Exception ex) {
            log.warn("[WebhookDeliveryService] Không thể lưu log webhook delivery: {}", ex.getMessage());
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<WebhookDeliveryEntity> getDeliveriesByRepository(Long repositoryId) {
        if (repositoryId == null) {
            return deliveryRepository.findTop100ByOrderByDeliveredAtDesc();
        }
        return deliveryRepository.findTop100ByRepositoryIdOrderByDeliveredAtDesc(repositoryId);
    }

    @Transactional(readOnly = true)
    public List<WebhookDeliveryEntity> getRecentDeliveries() {
        return deliveryRepository.findTop100ByOrderByDeliveredAtDesc();
    }

    private String extractRepoFullName(String rawPayload) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            String fullName = root.path("repository").path("full_name").asText(null);
            return StringUtils.hasText(fullName) ? fullName : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long extractGithubRepoId(String rawPayload) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            long id = root.path("repository").path("id").asLong(0L);
            return id > 0 ? id : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String buildPayloadSummary(String eventType, String rawPayload) {
        if (!StringUtils.hasText(rawPayload)) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            if ("pull_request".equalsIgnoreCase(eventType)) {
                String action = root.path("action").asText("");
                int number = root.path("pull_request").path("number").asInt(root.path("number").asInt(0));
                String title = root.path("pull_request").path("title").asText("");
                String sender = root.path("sender").path("login").asText(root.path("pull_request").path("user").path("login").asText(""));
                return String.format("PR #%d (%s)%s%s",
                        number,
                        action.isBlank() ? "event" : action,
                        title.isBlank() ? "" : ": " + truncate(title, 120),
                        sender.isBlank() ? "" : " • @" + sender);
            }
            if ("push".equalsIgnoreCase(eventType)) {
                String ref = root.path("ref").asText("");
                int commitCount = root.path("commits").isArray() ? root.path("commits").size() : 0;
                String pusher = root.path("pusher").path("name").asText(root.path("sender").path("login").asText(""));
                String headMsg = root.path("head_commit").path("message").asText("");
                return String.format("Push %s (%d commits)%s%s",
                        ref.isBlank() ? "branch" : ref.replace("refs/heads/", ""),
                        commitCount,
                        pusher.isBlank() ? "" : " bởi " + pusher,
                        headMsg.isBlank() ? "" : " — " + truncate(headMsg, 100));
            }
            if ("ping".equalsIgnoreCase(eventType)) {
                String zen = root.path("zen").asText("");
                return zen.isBlank() ? "GitHub Webhook Ping" : "Ping: " + truncate(zen, 120);
            }
        } catch (Exception ignored) {
        }
        return truncate(rawPayload.replaceAll("\\s+", " ").trim(), 200);
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }
}
