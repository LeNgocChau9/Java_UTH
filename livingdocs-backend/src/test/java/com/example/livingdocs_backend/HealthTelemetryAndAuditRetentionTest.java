package com.example.livingdocs_backend;

import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.List;

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
class HealthTelemetryAndAuditRetentionTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private AuditLogRepositoryPort auditLogRepositoryPort;

    private String adminToken;
    private String techLeadToken;
    private String developerToken;

    @BeforeEach
    void setUp() {
        adminToken = "Bearer " + jwtTokenProvider.generateToken(1L, "soopikorea@gmail.com", List.of("ADMIN"));
        techLeadToken = "Bearer " + jwtTokenProvider.generateToken(1L, "soopikorea@gmail.com", List.of("TECH_LEAD"));
        developerToken = "Bearer " + jwtTokenProvider.generateToken(999999L, "dev@livingdocs.io", List.of("DEVELOPER"));
    }

    @Test
    void detailedHealthEndpointEnforcesRbacAndReturnsRealPostgresPgvectorGithubAiEngineAndAuditLogs() throws Exception {
        // Unauthenticated -> 401
        mockMvc.perform(get("/api/health/detailed"))
                .andExpect(status().isUnauthorized());

        // DEVELOPER -> 403
        mockMvc.perform(get("/api/health/detailed")
                        .header("Authorization", developerToken))
                .andExpect(status().isForbidden());

        String markerDetail = "Telemetry-Verification-" + System.nanoTime();
        auditLogRepositoryPort.save(AuditLog.builder()
                .actorId(1L)
                .action(AuditAction.LOGIN_SUCCESS)
                .resourceType("SYSTEM")
                .resourceId("TELEMETRY_TEST")
                .detail(markerDetail)
                .build());

        // TECH_LEAD -> 200 with telemetry
        mockMvc.perform(get("/api/health/detailed")
                        .header("Authorization", techLeadToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("livingdocs-backend"))
                .andExpect(jsonPath("$.backend.status").value("UP"))
                .andExpect(jsonPath("$.postgres.status").value("UP"));

        // ADMIN -> 200 with full telemetry
        MvcResult result = mockMvc.perform(get("/api/health/detailed")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("livingdocs-backend"))
                .andExpect(jsonPath("$.backend.status").value("UP"))
                .andExpect(jsonPath("$.postgres.status").value("UP"))
                .andExpect(jsonPath("$.postgres.pgvectorInstalled").value(true))
                .andExpect(jsonPath("$.github").exists())
                .andExpect(jsonPath("$.aiEngine").exists())
                .andExpect(jsonPath("$.recentAuditLogs").isArray())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());

        // PostgreSQL real check
        assertTrue(root.path("postgres").path("latencyMs").asLong(-1) >= 0);
        assertFalse(root.path("postgres").path("pgvectorVersion").asText("").isBlank());

        // AI Engine graceful handling (either UP or OFFLINE, never 500)
        String aiStatus = root.path("aiEngine").path("status").asText("");
        assertTrue("UP".equals(aiStatus) || "OFFLINE".equals(aiStatus),
                "AI Engine status must be UP or OFFLINE, got: " + aiStatus);
        assertFalse(root.path("aiEngine").path("message").asText("").isBlank());

        // GitHub rate-limit section
        assertTrue(root.path("github").has("status"));
        assertTrue(root.path("github").has("authenticated"));

        // Recent audit logs from real DB (max 10, contains our saved marker)
        JsonNode logsNode = root.path("recentAuditLogs");
        assertTrue(logsNode.size() >= 1 && logsNode.size() <= 10);
        boolean foundMarker = false;
        for (JsonNode item : logsNode) {
            if (markerDetail.equals(item.path("detail").asText())) {
                foundMarker = true;
                break;
            }
        }
        assertTrue(foundMarker, "Expected recentAuditLogs to contain real DB record: " + markerDetail);
    }

    @Test
    void auditRetentionConfigAndCleanupEnforceRbacAndPreserveActorIdFromUserPrincipal() throws Exception {
        // Unauthenticated -> 401
        mockMvc.perform(get("/api/audit-logs/retention/config"))
                .andExpect(status().isUnauthorized());

        // DEVELOPER -> 403
        mockMvc.perform(get("/api/audit-logs/retention/config")
                        .header("Authorization", developerToken))
                .andExpect(status().isForbidden());

        // ADMIN GET config -> 200
        mockMvc.perform(get("/api/audit-logs/retention/config")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retentionDays").isNumber());

        // ADMIN PUT config -> 200 and updatedBy == 1
        String putPayload = """
                {
                  "retentionDays": 120,
                  "autoCleanupEnabled": false
                }
                """;
        mockMvc.perform(put("/api/audit-logs/retention/config")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(putPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retentionDays").value(120))
                .andExpect(jsonPath("$.autoCleanupEnabled").value(false))
                .andExpect(jsonPath("$.updatedBy").value(1));

        // ADMIN POST cleanup (365 days safe retention) -> 200 and records actorId == 1
        mockMvc.perform(post("/api/audit-logs/cleanup")
                        .header("Authorization", adminToken)
                        .param("retentionDays", "365"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retentionDaysApplied").value(365))
                .andExpect(jsonPath("$.triggerMethod").value("MANUAL_API"))
                .andExpect(jsonPath("$.executedAt").isNotEmpty());

        List<AuditLog> recent = auditLogRepositoryPort.findRecent();
        AuditLog cleanupLog = recent.stream()
                .filter(l -> l.getAction() == AuditAction.AUDIT_LOG_CLEANUP)
                .findFirst()
                .orElse(null);

        assertNotNull(cleanupLog, "Expected AUDIT_LOG_CLEANUP record in audit_logs");
        assertEquals(1L, cleanupLog.getActorId(),
                "parseActorId must extract userId from UserPrincipal instead of returning null");

        // Verify cleanup preserves updatedBy and updatedAt in retention config
        mockMvc.perform(get("/api/audit-logs/retention/config")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedBy").value(1))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.lastCleanupAt").isNotEmpty())
                .andExpect(jsonPath("$.lastCleanupStatus").value("SUCCESS"));
    }
}
