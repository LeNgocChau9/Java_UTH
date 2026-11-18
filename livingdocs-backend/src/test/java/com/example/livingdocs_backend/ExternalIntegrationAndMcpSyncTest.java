package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ManagerReviewDecisionRequest;
import com.example.livingdocs_backend.application.dto.StaffReviewDecisionRequest;
import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisRequestDto;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.service.DocDriftDetectionService;
import com.example.livingdocs_backend.application.service.ExternalDocumentFetchService;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.infrastructure.notification.ExternalIntegrationWebhookDispatcher;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ExternalIntegrationEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataExternalIntegrationRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5433/livingdocs",
        "spring.datasource.username=LivingDocs",
        "spring.datasource.password=chau123456",
        "spring.datasource.driver-class-name=org.postgresql.Driver"
})
class ExternalIntegrationAndMcpSyncTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private SpringDataExternalIntegrationRepository integrationRepository;

    @Autowired
    private SpringDataRepositoryRepository repositoryRepository;

    @Autowired
    private DocumentServicePort documentServicePort;

    @Autowired
    private DocDriftDetectionService docDriftDetectionService;

    @Autowired
    private ExternalDocumentFetchService externalDocumentFetchService;

    private HttpServer mockHttpServer;
    private int serverPort;
    private final List<CapturedRequest> capturedWebhooks = new CopyOnWriteArrayList<>();
    private volatile CountDownLatch webhookLatch;

    private String adminBearerToken;
    private String devBearerToken;
    private Long existingRepoId;

    record CapturedRequest(String path, String signatureHeader, String body) {
    }

    @BeforeEach
    void setUp() throws Exception {
        capturedWebhooks.clear();
        webhookLatch = null;

        mockHttpServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serverPort = mockHttpServer.getAddress().getPort();

        // Endpoint nhận webhook Slack / Discord / Custom
        mockHttpServer.createContext("/webhook/", exchange -> {
            byte[] reqBytes = exchange.getRequestBody().readAllBytes();
            String body = new String(reqBytes, StandardCharsets.UTF_8);
            String sig = exchange.getRequestHeaders().getFirst("X-LivingDocs-Signature");
            capturedWebhooks.add(new CapturedRequest(exchange.getRequestURI().getPath(), sig, body));
            if (webhookLatch != null) {
                webhookLatch.countDown();
            }
            byte[] resp = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, resp.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(resp);
            }
        });

        // Endpoint giả lập Confluence REST API
        mockHttpServer.createContext("/confluence/rest/api/content/999", exchange -> {
            String json = """
                    {
                      "id": "999",
                      "title": "Confluence Architecture Guide",
                      "body": {
                        "storage": {
                          "value": "<h1>System Overview</h1><p>Real synced content from <code>ConfluenceService</code>.</p><ul><li>Step 1</li><li>Step 2</li></ul>"
                        }
                      }
                    }
                    """;
            byte[] resp = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, resp.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(resp);
            }
        });

        // Endpoint giả lập Notion Blocks JSON
        mockHttpServer.createContext("/notion/blocks", exchange -> {
            String json = """
                    {
                      "results": [
                        {
                          "type": "heading_1",
                          "heading_1": { "rich_text": [{ "plain_text": "Notion API Specification" }] }
                        },
                        {
                          "type": "paragraph",
                          "paragraph": { "rich_text": [{ "plain_text": "Synced directly from Notion blocks endpoint." }] }
                        },
                        {
                          "type": "bulleted_list_item",
                          "bulleted_list_item": { "rich_text": [{ "plain_text": "Supports Markdown conversion" }] }
                        }
                      ]
                    }
                    """;
            byte[] resp = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, resp.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(resp);
            }
        });

        // Endpoint giả lập GitHub Raw Markdown
        mockHttpServer.createContext("/github-raw/README.md", exchange -> {
            String md = "# Real GitHub Raw README\n\nFetched over HTTP into DRAFT v1.";
            byte[] resp = md.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/plain; charset=UTF-8");
            exchange.sendResponseHeaders(200, resp.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(resp);
            }
        });

        mockHttpServer.start();

        adminBearerToken = "Bearer " + jwtTokenProvider.generateToken(
                1L,
                "soopikorea@gmail.com",
                List.of("ADMIN", "TECH_LEAD", "MANAGER")
        );
        devBearerToken = "Bearer " + jwtTokenProvider.generateToken(
                2L,
                "soopikorea555@gmail.com",
                List.of("DEVELOPER")
        );

        existingRepoId = repositoryRepository.findAll().stream()
                .findFirst()
                .map(RepositoryEntity::getRepositoryId)
                .orElse(3L);
    }

    @AfterEach
    void tearDown() {
        if (mockHttpServer != null) {
            mockHttpServer.stop(0);
        }
    }

    @Test
    void crudAndTestConnectionForSlackDiscordAndCustomWebhook() throws Exception {
        // 1. GET list returns core providers
        mockMvc.perform(get("/api/external-integrations")
                        .header("Authorization", adminBearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$[0].provider").value("SLACK"))
                .andExpect(jsonPath("$[1].provider").value("DISCORD"))
                .andExpect(jsonPath("$[2].provider").value("CUSTOM_WEBHOOK"));

        // 2. DEVELOPER without admin/lead/manager role cannot mutate integrations
        mockMvc.perform(put("/api/external-integrations/SLACK")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"webhookUrl\":\"http://127.0.0.1:" + serverPort + "/webhook/slack\"}"))
                .andExpect(status().isForbidden());

        // 3. PUT Slack configuration
        String slackUrl = "http://127.0.0.1:" + serverPort + "/webhook/slack";
        String putSlackBody = String.format("""
                {
                  "enabled": true,
                  "webhookUrl": "%s",
                  "channelName": "#livingdocs-alerts",
                  "events": ["DRIFT_HIGH_CRITICAL", "REVIEW_SUBMITTED", "DOCUMENT_PUBLISHED"]
                }
                """, slackUrl);

        mockMvc.perform(put("/api/external-integrations/SLACK")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(putSlackBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("SLACK"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.secretConfigured").value(true))
                .andExpect(jsonPath("$.webhookUrl").value(slackUrl));

        // 4. Verify persisted in PostgreSQL
        ExternalIntegrationEntity stored = integrationRepository
                .findByProviderAndWorkspaceId("SLACK", 1L)
                .orElseThrow();
        assertTrue(stored.isEnabled());
        assertTrue(stored.isSecretConfigured());

        // 5. GET single provider
        mockMvc.perform(get("/api/external-integrations/SLACK")
                        .header("Authorization", adminBearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("SLACK"))
                .andExpect(jsonPath("$.webhookUrl").value(slackUrl));

        // 6. Test Connection for Slack, Discord, and Custom Webhook
        String customUrl = "http://127.0.0.1:" + serverPort + "/webhook/custom";
        String discordUrl = "http://127.0.0.1:" + serverPort + "/webhook/discord";

        mockMvc.perform(post("/api/external-integrations/test")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"provider\":\"SLACK\",\"webhookUrl\":\"" + slackUrl + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.statusCode").value(200));

        mockMvc.perform(post("/api/external-integrations/test")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"provider\":\"DISCORD\",\"webhookUrl\":\"" + discordUrl + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.statusCode").value(200));

        mockMvc.perform(post("/api/external-integrations/test")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"provider\":\"CUSTOM_WEBHOOK\",\"webhookUrl\":\"" + customUrl + "\",\"secret\":\"my-hmac-secret\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.statusCode").value(200));

        assertEquals(3, capturedWebhooks.size());

        JsonNode slackJson = objectMapper.readTree(capturedWebhooks.get(0).body());
        assertTrue(slackJson.has("blocks"));
        assertEquals(ExternalIntegrationWebhookDispatcher.SLACK_COLOR_PUBLISHED,
                slackJson.path("attachments").get(0).path("color").asText());

        JsonNode discordJson = objectMapper.readTree(capturedWebhooks.get(1).body());
        assertEquals(ExternalIntegrationWebhookDispatcher.DISCORD_COLOR_GREEN,
                discordJson.path("embeds").get(0).path("color").asInt());

        CapturedRequest customReq = capturedWebhooks.get(2);
        assertNotNull(customReq.signatureHeader());
        assertTrue(customReq.signatureHeader().startsWith("sha256="));
        JsonNode customJson = objectMapper.readTree(customReq.body());
        assertEquals("TEST_CONNECTION", customJson.path("event").asText());
        assertTrue(customJson.has("timestamp"));
        assertTrue(customJson.has("data"));
    }

    @Test
    void webhookDispatcherSendsFormattedNotificationsForDriftReviewAndPublish() throws Exception {
        String slackUrl = "http://127.0.0.1:" + serverPort + "/webhook/slack";
        String discordUrl = "http://127.0.0.1:" + serverPort + "/webhook/discord";
        String customUrl = "http://127.0.0.1:" + serverPort + "/webhook/custom";

        mockMvc.perform(put("/api/external-integrations/SLACK")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"webhookUrl\":\"" + slackUrl + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/external-integrations/DISCORD")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"webhookUrl\":\"" + discordUrl + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/external-integrations/CUSTOM_WEBHOOK")
                        .header("Authorization", adminBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"webhookUrl\":\"" + customUrl + "\",\"secret\":\"whsec_123\"}"))
                .andExpect(status().isOk());

        // Import một tài liệu vào DRAFT
        String rawMdUrl = "http://127.0.0.1:" + serverPort + "/github-raw/README.md";
        MvcResult importRes = mockMvc.perform(post("/api/documents/import/external")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "repoId": %d,
                                  "title": "Dispatcher Integration Doc",
                                  "sourceType": "GITHUB_RAW",
                                  "sourceUrlOrId": "%s"
                                }
                                """, existingRepoId, rawMdUrl)))
                .andExpect(status().isCreated())
                .andReturn();

        long docId = objectMapper.readTree(importRes.getResponse().getContentAsString()).get("docId").asLong();

        // Event 1: Developer submit for Staff review (3 webhooks: Slack + Discord + Custom)
        webhookLatch = new CountDownLatch(3);
        documentServicePort.submitForReview(docId, 2L);
        assertTrue(webhookLatch.await(5, TimeUnit.SECONDS), "Chờ webhook REVIEW_SUBMITTED");

        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/slack") && r.body().contains(ExternalIntegrationWebhookDispatcher.SLACK_COLOR_REVIEW)));
        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/discord") && r.body().contains(String.valueOf(ExternalIntegrationWebhookDispatcher.DISCORD_COLOR_BLUE))));
        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/custom") && r.body().contains("\"REVIEW_SUBMITTED\"")));

        capturedWebhooks.clear();

        // Staff approve -> UNDER_REVIEW_MANAGER
        StaffReviewDecisionRequest staffReq = new StaffReviewDecisionRequest();
        staffReq.setDecision("APPROVE");
        staffReq.setComment("Looks good");
        documentServicePort.processStaffReview(docId, staffReq, 1L, "STAFF");

        // Event 2: Manager published (commitToGithub = false)
        webhookLatch = new CountDownLatch(3);
        ManagerReviewDecisionRequest mgrReq = new ManagerReviewDecisionRequest();
        mgrReq.setDecision("PUBLISH");
        mgrReq.setCommitToGithub(false);
        mgrReq.setComment("Publish now");
        documentServicePort.processManagerReview(docId, mgrReq, 1L, "MANAGER");
        assertTrue(webhookLatch.await(5, TimeUnit.SECONDS), "Chờ webhook DOCUMENT_PUBLISHED");

        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/slack") && r.body().contains(ExternalIntegrationWebhookDispatcher.SLACK_COLOR_PUBLISHED)));
        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/discord") && r.body().contains(String.valueOf(ExternalIntegrationWebhookDispatcher.DISCORD_COLOR_GREEN))));
        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/custom") && r.body().contains("\"DOCUMENT_PUBLISHED\"")));

        capturedWebhooks.clear();

        // Event 3: Drift HIGH/CRITICAL (tài liệu ngắn kích hoạt severity HIGH trong analyzeSingleDocumentManual)
        webhookLatch = new CountDownLatch(3);
        ManualDriftAnalysisRequestDto driftReq = new ManualDriftAnalysisRequestDto();
        driftReq.setMode("DOCUMENT");
        driftReq.setDocumentId(docId);
        docDriftDetectionService.triggerManualDriftAnalysis(driftReq);
        assertTrue(webhookLatch.await(5, TimeUnit.SECONDS), "Chờ webhook DRIFT_HIGH_CRITICAL");

        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/slack") && r.body().contains(ExternalIntegrationWebhookDispatcher.SLACK_COLOR_DRIFT)));
        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/discord") && r.body().contains(String.valueOf(ExternalIntegrationWebhookDispatcher.DISCORD_COLOR_RED))));
        assertTrue(capturedWebhooks.stream().anyMatch(r ->
                r.path().equals("/webhook/custom") && r.body().contains("\"DRIFT_HIGH_CRITICAL\"")));
    }

    @Test
    void importExternalDocumentLoadsRealContentInsteadOfStub() throws Exception {
        // 1. Confluence REST JSON -> Markdown into DRAFT
        String confluenceUrl = "http://127.0.0.1:" + serverPort + "/confluence/rest/api/content/999";
        MvcResult confRes = mockMvc.perform(post("/api/documents/import/external")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "repoId": %d,
                                  "title": "Confluence Sync Test",
                                  "sourceType": "CONFLUENCE",
                                  "sourceUrlOrId": "%s"
                                }
                                """, existingRepoId, confluenceUrl)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(DocumentStatus.DRAFT.name()))
                .andExpect(jsonPath("$.currentVersion").value(1))
                .andReturn();

        String confContent = objectMapper.readTree(confRes.getResponse().getContentAsString())
                .path("latestVersion").path("content").asText();
        assertFalse(confContent.contains("Nội dung tài liệu đang được đồng bộ."));
        assertTrue(confContent.contains("System Overview"));
        assertTrue(confContent.contains("ConfluenceService"));

        // 2. Notion Blocks JSON -> Markdown into DRAFT
        String notionUrl = "http://127.0.0.1:" + serverPort + "/notion/blocks";
        MvcResult notionRes = mockMvc.perform(post("/api/documents/import/external")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "repoId": %d,
                                  "title": "Notion Sync Test",
                                  "sourceType": "NOTION",
                                  "sourceUrlOrId": "%s"
                                }
                                """, existingRepoId, notionUrl)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(DocumentStatus.DRAFT.name()))
                .andReturn();

        String notionContent = objectMapper.readTree(notionRes.getResponse().getContentAsString())
                .path("latestVersion").path("content").asText();
        assertFalse(notionContent.contains("Nội dung tài liệu đang được đồng bộ."));
        assertTrue(notionContent.contains("# Notion API Specification"));
        assertTrue(notionContent.contains("- Supports Markdown conversion"));

        // 3. URL Transformation helpers for GitHub Blob & Google Docs Public
        assertEquals(
                "https://raw.githubusercontent.com/org/repo/main/docs/ARCH.md",
                externalDocumentFetchService.convertGitHubBlobToRaw("https://github.com/org/repo/blob/main/docs/ARCH.md")
        );
        assertEquals(
                "https://docs.google.com/document/d/1AbCDefGhIJkLMnoPQRstUvWXyz/export?format=txt",
                externalDocumentFetchService.resolveGoogleDocsExportUrl("https://docs.google.com/document/d/1AbCDefGhIJkLMnoPQRstUvWXyz/edit?usp=sharing")
        );
    }

    @Test
    void notificationPreferencesGetAndPutPersistToPostgreSql() throws Exception {
        String payload = """
                {
                  "emailEnabled": false,
                  "reviewEnabled": true,
                  "driftAlertEnabled": false,
                  "githubTokenIssueEnabled": true
                }
                """;

        mockMvc.perform(put("/api/me/notification-preferences")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailEnabled").value(false))
                .andExpect(jsonPath("$.reviewEnabled").value(true))
                .andExpect(jsonPath("$.driftAlertEnabled").value(false))
                .andExpect(jsonPath("$.githubTokenIssueEnabled").value(true));

        mockMvc.perform(get("/api/me/notification-preferences")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailEnabled").value(false))
                .andExpect(jsonPath("$.reviewEnabled").value(true))
                .andExpect(jsonPath("$.driftAlertEnabled").value(false))
                .andExpect(jsonPath("$.githubTokenIssueEnabled").value(true));
    }
}
