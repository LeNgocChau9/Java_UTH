package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.port.CiTokenRepositoryPort;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataWebhookDeliveryRepository;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

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
class RbacSecurityAndCiTokenIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private CiTokenRepositoryPort ciTokenRepositoryPort;

    @Autowired
    private SpringDataRepositoryRepository repositoryRepository;

    @Autowired
    private SpringDataWebhookDeliveryRepository webhookDeliveryRepository;

    @Value("${github.webhook.secret:}")
    private String webhookSecret;

    private String adminToken;
    private String techLeadToken;
    private String managerToken;
    private String staffToken;
    private String developerToken;
    private Long existingRepoId;
    private String existingRepoFullName;

    @BeforeEach
    void setUp() {
        adminToken = "Bearer " + jwtTokenProvider.generateToken(1L, "soopikorea@gmail.com", List.of("ADMIN"));
        techLeadToken = "Bearer " + jwtTokenProvider.generateToken(1L, "soopikorea@gmail.com", List.of("TECH_LEAD"));
        managerToken = "Bearer " + jwtTokenProvider.generateToken(1L, "soopikorea@gmail.com", List.of("MANAGER"));
        staffToken = "Bearer " + jwtTokenProvider.generateToken(2L, "soopikorea555@gmail.com", List.of("STAFF"));
        developerToken = "Bearer " + jwtTokenProvider.generateToken(1L, "soopikorea@gmail.com", List.of("DEVELOPER"));

        RepositoryEntity repo = repositoryRepository.findAll().stream().findFirst().orElse(null);
        existingRepoId = repo != null ? repo.getRepositoryId() : 1L;
        existingRepoFullName = repo != null ? repo.getRepoFullName() : "livingdocs/demo-repo";
    }

    @Test
    void unauthenticatedRequestsToProtectedEndpointsReturn401WhilePublicEndpointsRemainAccessible() throws Exception {
        List<String> protectedGetEndpoints = List.of(
                "/api/documents",
                "/api/templates",
                "/api/collections",
                "/api/repos",
                "/api/repositories",
                "/api/reviews/staff/queue",
                "/api/jobs",
                "/api/v1/code-entities/gaps",
                "/api/code-diff/repositories/1/alerts",
                "/api/v1/settings/ai",
                "/api/v1/settings/pr-blocking",
                "/api/drift-alerts",
                "/api/dashboard/stats",
                "/api/ci-tokens",
                "/api/ci/tokens",
                "/api/webhooks/deliveries",
                "/api/repos/1/webhook-deliveries",
                "/api/me"
        );

        for (String endpoint : protectedGetEndpoints) {
            mockMvc.perform(get(endpoint))
                    .andExpect(status().isUnauthorized());
        }

        // Public health check
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        // Public landing chat
        mockMvc.perform(post("/api/v1/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Xin chào LivingDocs\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").isNotEmpty());
    }

    @Test
    void preAuthorizeEnforcesFiveRoleMatrixAcrossControllers() throws Exception {
        // 1. CiTokenController: ADMIN, TECH_LEAD, DEVELOPER allowed; STAFF & MANAGER forbidden
        mockMvc.perform(get("/api/ci-tokens").header("Authorization", adminToken)).andExpect(status().isOk());
        mockMvc.perform(get("/api/ci/tokens").header("Authorization", techLeadToken)).andExpect(status().isOk());
        mockMvc.perform(get("/api/ci-tokens").header("Authorization", developerToken)).andExpect(status().isOk());
        mockMvc.perform(get("/api/ci-tokens").header("Authorization", staffToken)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/ci-tokens").header("Authorization", managerToken)).andExpect(status().isForbidden());

        // 2. DocTemplateController: DEVELOPER can read, but cannot create/delete templates
        mockMvc.perform(get("/api/templates").header("Authorization", developerToken)).andExpect(status().isOk());
        mockMvc.perform(post("/api/templates")
                        .header("Authorization", developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Blocked\",\"type\":\"BLOCKED_TYPE\",\"structureJson\":\"{}\"}"))
                .andExpect(status().isForbidden());

        // 3. PrMergeBlockingController: DEVELOPER can read, cannot update; MANAGER can update
        mockMvc.perform(get("/api/v1/settings/pr-blocking").header("Authorization", developerToken))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/settings/pr-blocking")
                        .header("Authorization", developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"blockingMode\":\"STRICT\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/settings/pr-blocking")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"blockingMode\":\"WARN_ONLY\",\"minSeverity\":\"CRITICAL\"}"))
                .andExpect(status().isOk());

        // 4. AiSettingController: DEVELOPER can read, cannot overwrite AI settings
        mockMvc.perform(get("/api/v1/settings/ai").header("Authorization", developerToken))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/settings/ai")
                        .header("Authorization", developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cloudProvider\":\"gemini\"}"))
                .andExpect(status().isForbidden());

        // 5. AutoDraftController & DocumentController review boundaries
        mockMvc.perform(post("/api/drift-alerts/1/accept-draft").header("Authorization", developerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/documents/1/staff-review").header("Authorization", developerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/documents/1/manager-review").header("Authorization", staffToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void ciTokenFullLifecycleWithDriftScanAndRevocation() throws Exception {
        // 1. DEVELOPER creates CI token
        String createBody = String.format("""
                {
                  "tokenName": "M3 CI Runner Token",
                  "repositoryId": %d,
                  "expiresInDays": 30,
                  "description": "Integration test CI token"
                }
                """, existingRepoId);

        MvcResult createRes = mockMvc.perform(post("/api/ci-tokens")
                        .header("Authorization", developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tokenName").value("M3 CI Runner Token"))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.tokenPrefix").isString())
                .andReturn();

        JsonNode createdJson = objectMapper.readTree(createRes.getResponse().getContentAsString());
        long tokenId = createdJson.get("tokenId").asLong();
        String rawToken = createdJson.get("token").asText();
        String prefix = createdJson.get("tokenPrefix").asText();

        assertTrue(rawToken.startsWith("lvd_ci_"), "Token must start with lvd_ci_");
        assertTrue(prefix.startsWith("lvd_ci_"));

        // 2. Listing tokens must NOT expose raw token
        MvcResult listRes = mockMvc.perform(get("/api/ci-tokens")
                        .header("Authorization", developerToken))
                .andExpect(status().isOk())
                .andReturn();
        assertFalse(listRes.getResponse().getContentAsString().contains(rawToken));

        // 3. GitHub Action calls POST /api/ci/drift-scan using X-CI-Token (no JWT)
        String scanPayload = String.format("""
                {
                  "repoId": %d,
                  "prNumber": 77,
                  "commitHash": "abc1234567",
                  "branch": "feature/rbac-lockdown",
                  "alerts": [
                    {
                      "filePath": "src/main/java/SecurityConfig.java",
                      "severity": "HIGH",
                      "changeType": "SIGNATURE_CHANGED",
                      "diffSnippet": "+ .anyRequest().authenticated()"
                    }
                  ]
                }
                """, existingRepoId);

        mockMvc.perform(post("/api/ci/drift-scan")
                        .header("X-CI-Token", rawToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.totalAlertsRecorded").value(1));

        CiToken touched = ciTokenRepositoryPort.findById(tokenId).orElseThrow();
        assertNotNull(touched.getLastUsedAt(), "lastUsedAt must be updated after CI drift scan");
        assertFalse(touched.isRevoked());

        // 4. Revoke token via DELETE /api/ci-tokens/{id}
        mockMvc.perform(delete("/api/ci-tokens/" + tokenId)
                        .header("Authorization", developerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        CiToken revoked = ciTokenRepositoryPort.findById(tokenId).orElseThrow();
        assertTrue(revoked.isRevoked());

        // 5. Subsequent CI drift scan with revoked token must return 401
        mockMvc.perform(post("/api/ci/drift-scan")
                        .header("X-CI-Token", rawToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanPayload))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void webhookDeliveryLogsArePersistedAndQueryablePerRepository() throws Exception {
        String deliveryId = "m3-deliv-" + UUID.randomUUID();
        String pingPayload = String.format("""
                {
                  "zen": "Keep it logically awesome.",
                  "repository": {
                    "id": 999999,
                    "full_name": "%s"
                  }
                }
                """, existingRepoFullName);

        var reqBuilder = post("/api/webhooks/github")
                .header("X-GitHub-Event", "ping")
                .header("X-GitHub-Delivery", deliveryId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(pingPayload);

        if (webhookSecret != null && !webhookSecret.isBlank()) {
            reqBuilder.header("X-Hub-Signature-256", computeHmacSha256(pingPayload, webhookSecret));
        }

        mockMvc.perform(reqBuilder)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verify delivery recorded in PostgreSQL & queryable via /api/webhooks/deliveries and /api/repos/{id}/webhook-deliveries
        MvcResult deliveriesRes = mockMvc.perform(get("/api/webhooks/deliveries")
                        .header("Authorization", developerToken))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(deliveriesRes.getResponse().getContentAsString().contains(deliveryId));

        MvcResult repoDeliveriesRes = mockMvc.perform(get("/api/repos/" + existingRepoId + "/webhook-deliveries")
                        .header("Authorization", developerToken))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(repoDeliveriesRes.getResponse().getContentAsString().contains(deliveryId));

        // Cleanup REQUIRES_NEW delivery record so test leaves database clean
        webhookDeliveryRepository.findTop100ByOrderByDeliveredAtDesc().stream()
                .filter(d -> deliveryId.equals(d.getDeliveryId()))
                .forEach(webhookDeliveryRepository::delete);
    }

    private String computeHmacSha256(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hmac = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return "sha256=" + HexFormat.of().formatHex(hmac);
    }
}
