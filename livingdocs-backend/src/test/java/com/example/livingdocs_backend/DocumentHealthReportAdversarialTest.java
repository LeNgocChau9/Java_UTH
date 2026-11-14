package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.RepoCoverageDto;
import com.example.livingdocs_backend.application.dto.health.CoverageGapsResponse;
import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import com.example.livingdocs_backend.application.service.DocumentHealthReportServiceImpl;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.web.controller.DocumentHealthReportController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Adversarial stress test harness for DocumentHealthReportService and DocumentHealthReportController.
 * Empirically tests edge cases: null repositoryId, non-existent repos, docs-only, code-only, corrupted entities, and NPE resistance.
 */
class DocumentHealthReportAdversarialTest {

    private DashboardStatsQueryPort queryPort;
    private SpringDataRepositoryRepository repositoryRepository;
    private SpringDataCodeEntityRepository codeEntityRepository;
    private SpringDataDocumentRepository documentRepository;
    private DocumentHealthReportServiceImpl healthReportService;
    private DocumentHealthReportController controller;

    @BeforeEach
    void setUp() {
        queryPort = mock(DashboardStatsQueryPort.class);
        repositoryRepository = mock(SpringDataRepositoryRepository.class);
        codeEntityRepository = mock(SpringDataCodeEntityRepository.class);
        documentRepository = mock(SpringDataDocumentRepository.class);

        healthReportService = new DocumentHealthReportServiceImpl(
                queryPort,
                repositoryRepository,
                codeEntityRepository,
                documentRepository
        );

        controller = new DocumentHealthReportController(healthReportService);
    }

    @Test
    @DisplayName("Edge Case 1: repositoryId == null (System-wide report) with populated data")
    void testRepositoryIdNull_PopulatedSystem() {
        when(queryPort.countScannedClassesAndFunctions(null)).thenReturn(200L);
        when(queryPort.countDocumentedEntities(null)).thenReturn(160L);
        when(queryPort.countDocuments(null)).thenReturn(50L);
        when(queryPort.countFreshDocuments(null)).thenReturn(45L);
        when(queryPort.findLatestCommitAt(null)).thenReturn(Optional.of(Instant.now()));

        Map<String, Long> missingMap = new LinkedHashMap<>();
        missingMap.put("CLASS", 5L);
        missingMap.put("METHOD", 35L);
        when(queryPort.countMissingEntitiesByType(null)).thenReturn(
                MissingDocEntityStatsDto.builder()
                        .totalMissing(40L)
                        .missingClasses(5L)
                        .missingMethodsAndFunctions(35L)
                        .missingByType(missingMap)
                        .build()
        );

        Map<String, Long> alerts = new LinkedHashMap<>();
        alerts.put("LOW", 1L);
        alerts.put("MEDIUM", 2L);
        alerts.put("HIGH", 0L);
        alerts.put("CRITICAL", 0L);
        when(queryPort.countOpenAlertsBySeverity(null)).thenReturn(alerts);

        when(queryPort.findRepoCoverages()).thenReturn(List.of(
                RepoCoverageDto.builder().repoId(1L).repoName("Repo-A").coveragePercent(80.0).build()
        ));

        DocumentHealthReportResponse response = healthReportService.generateHealthReport(null);

        assertNotNull(response);
        assertNull(response.getRepositoryId());
        assertNull(response.getRepositoryName());
        assertTrue(response.isReadyForScan());
        assertTrue(response.getHasData());
        assertEquals(80.0, response.getCoveragePercent());
        assertEquals(90.0, response.getFreshnessPercent());
        assertEquals(1, response.getRepositoryDetails().size());

        // Verify Markdown export for system-wide
        String markdown = healthReportService.exportHealthReportMarkdown(null);
        assertNotNull(markdown);
        assertTrue(markdown.contains("Toàn bộ hệ thống"));
        assertTrue(markdown.contains("Repo-A"));
    }

    @Test
    @DisplayName("Edge Case 1b: repositoryId == null (System-wide report) with empty system")
    void testRepositoryIdNull_EmptySystem() {
        when(queryPort.countScannedClassesAndFunctions(null)).thenReturn(0L);
        when(queryPort.countDocumentedEntities(null)).thenReturn(0L);
        when(queryPort.countDocuments(null)).thenReturn(0L);
        when(queryPort.countFreshDocuments(null)).thenReturn(0L);
        when(queryPort.findLatestCommitAt(null)).thenReturn(Optional.empty());

        when(queryPort.countMissingEntitiesByType(null)).thenReturn(
                MissingDocEntityStatsDto.builder()
                        .totalMissing(0L)
                        .missingClasses(0L)
                        .missingMethodsAndFunctions(0L)
                        .missingByType(Collections.emptyMap())
                        .build()
        );

        when(queryPort.countOpenAlertsBySeverity(null)).thenReturn(Collections.emptyMap());
        when(queryPort.findRepoCoverages()).thenReturn(Collections.emptyList());

        assertDoesNotThrow(() -> {
            DocumentHealthReportResponse response = healthReportService.generateHealthReport(null);
            assertNotNull(response);
            assertNull(response.getRepositoryId());
            assertEquals(0.0, response.getCoveragePercent());
            assertEquals(0.0, response.getFreshnessPercent());
        });

        assertDoesNotThrow(() -> {
            String markdown = healthReportService.exportHealthReportMarkdown(null);
            assertNotNull(markdown);
            assertTrue(markdown.contains("Toàn bộ hệ thống"));
        });
    }

    @Test
    @DisplayName("Edge Case 2: repositoryId does not exist in database")
    void testRepositoryDoesNotExist() {
        Long nonExistentId = 999999L;
        when(repositoryRepository.findById(nonExistentId)).thenReturn(Optional.empty());
        when(queryPort.countScannedClassesAndFunctions(nonExistentId)).thenReturn(0L);
        when(queryPort.countDocumentedEntities(nonExistentId)).thenReturn(0L);
        when(queryPort.countDocuments(nonExistentId)).thenReturn(0L);
        when(queryPort.countFreshDocuments(nonExistentId)).thenReturn(0L);
        when(queryPort.findLatestCommitAt(nonExistentId)).thenReturn(Optional.empty());
        when(documentRepository.findByRepoId(nonExistentId)).thenReturn(Collections.emptyList());
        when(codeEntityRepository.findCoverageGaps(nonExistentId)).thenReturn(Collections.emptyList());

        // 1. Generate health report
        DocumentHealthReportResponse report = healthReportService.generateHealthReport(nonExistentId);
        assertNotNull(report);
        assertEquals(nonExistentId, report.getRepositoryId());
        assertNull(report.getRepositoryName());
        assertFalse(report.isReadyForScan());
        assertFalse(report.getHasData());
        assertEquals("NOT_CONFIGURED", report.getOverallRating());
        assertEquals(0.0, report.getCoveragePercent());
        assertEquals(0L, report.getTotalScannedEntities());
        assertEquals(0L, report.getTotalDocuments());

        // 2. Coverage gaps
        CoverageGapsResponse gaps = healthReportService.getCoverageGaps(nonExistentId);
        assertNotNull(gaps);
        assertEquals(nonExistentId, gaps.getRepositoryId());
        assertNull(gaps.getRepositoryName());
        assertEquals(0L, gaps.getTotalMissing());
        assertTrue(gaps.getPackages().isEmpty());
        assertTrue(gaps.getItems().isEmpty());

        // 3. Export Markdown
        String markdown = healthReportService.exportHealthReportMarkdown(nonExistentId);
        assertNotNull(markdown);
        assertTrue(markdown.contains("Kho lưu trữ ID #999999"));
        assertTrue(markdown.contains("NOT_CONFIGURED"));
        assertTrue(markdown.contains("Kho Lưu Trữ Chưa Sẵn Sàng Quét"));
    }

    @Test
    @DisplayName("Edge Case 3: repository has documents (MCP connected) but 0 code entities")
    void testRepositoryWithDocumentsOnly_ZeroCodeEntities() {
        Long repoId = 10L;
        when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(
                RepositoryEntity.builder().repositoryId(repoId).repoName("docs-only-repo").build()
        ));
        when(queryPort.countScannedClassesAndFunctions(repoId)).thenReturn(0L);
        when(queryPort.countDocumentedEntities(repoId)).thenReturn(0L);
        when(queryPort.countDocuments(repoId)).thenReturn(5L);
        when(queryPort.countFreshDocuments(repoId)).thenReturn(5L);
        when(queryPort.findLatestCommitAt(repoId)).thenReturn(Optional.of(Instant.now()));

        DocumentEntity mockDoc = mock(DocumentEntity.class);
        when(documentRepository.findByRepoId(repoId)).thenReturn(List.of(mockDoc));

        Map<String, Long> emptyMissing = new LinkedHashMap<>();
        emptyMissing.put("CLASS", 0L);
        emptyMissing.put("METHOD", 0L);
        when(queryPort.countMissingEntitiesByType(repoId)).thenReturn(
                MissingDocEntityStatsDto.builder()
                        .totalMissing(0L)
                        .missingClasses(0L)
                        .missingMethodsAndFunctions(0L)
                        .missingByType(emptyMissing)
                        .build()
        );

        when(queryPort.countOpenAlertsBySeverity(repoId)).thenReturn(Collections.emptyMap());
        when(codeEntityRepository.findCoverageGaps(repoId)).thenReturn(Collections.emptyList());

        // Ready for scan should be TRUE because MCP documents exist
        DocumentHealthReportResponse report = healthReportService.generateHealthReport(repoId);
        assertNotNull(report);
        assertTrue(report.isReadyForScan());
        assertTrue(report.getHasData());
        assertEquals(0.0, report.getCoveragePercent());
        assertEquals(100.0, report.getFreshnessPercent());
        assertEquals(5L, report.getTotalDocuments());
        assertEquals(0L, report.getTotalScannedEntities());
        // Overall score: 0*0.4 + 100*0.35 + 100*0.25 = 60.0 -> POOR (C)
        assertNotNull(report.getCompliance());
        assertEquals(60.0, report.getCompliance().getOverallScore());
        assertEquals("POOR (C)", report.getCompliance().getRating());

        // Coverage gaps should be empty
        CoverageGapsResponse gaps = healthReportService.getCoverageGaps(repoId);
        assertNotNull(gaps);
        assertEquals(0L, gaps.getTotalMissing());
        assertTrue(gaps.getItems().isEmpty());

        // Markdown should render valid report with 0 code entities and 5 docs
        String markdown = healthReportService.exportHealthReportMarkdown(repoId);
        assertNotNull(markdown);
        assertTrue(markdown.contains("docs-only-repo"));
        assertTrue(markdown.contains("5 / 5 tài liệu khớp với commit mới nhất"));
        assertTrue(markdown.contains("POOR (C)"));
    }

    @Test
    @DisplayName("Edge Case 4: repository has code entities but 0 documents")
    void testRepositoryWithCodeEntitiesOnly_ZeroDocuments() {
        Long repoId = 11L;
        when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(
                RepositoryEntity.builder().repositoryId(repoId).repoName("code-only-repo").build()
        ));
        when(queryPort.countScannedClassesAndFunctions(repoId)).thenReturn(40L);
        when(queryPort.countDocumentedEntities(repoId)).thenReturn(0L);
        when(queryPort.countDocuments(repoId)).thenReturn(0L);
        when(queryPort.countFreshDocuments(repoId)).thenReturn(0L);
        when(queryPort.findLatestCommitAt(repoId)).thenReturn(Optional.of(Instant.now()));
        when(documentRepository.findByRepoId(repoId)).thenReturn(Collections.emptyList());

        Map<String, Long> missingMap = new LinkedHashMap<>();
        missingMap.put("CLASS", 10L);
        missingMap.put("METHOD", 30L);
        when(queryPort.countMissingEntitiesByType(repoId)).thenReturn(
                MissingDocEntityStatsDto.builder()
                        .totalMissing(40L)
                        .missingClasses(10L)
                        .missingMethodsAndFunctions(30L)
                        .missingByType(missingMap)
                        .build()
        );

        when(queryPort.countOpenAlertsBySeverity(repoId)).thenReturn(Collections.emptyMap());

        List<CodeEntityJpaEntity> codeEntities = List.of(
                CodeEntityJpaEntity.builder()
                        .entityId(101L)
                        .repositoryId(repoId)
                        .filePath("src/main/java/com/test/Worker.java")
                        .entityType("CLASS")
                        .className("Worker")
                        .docStatus("UNDOCUMENTED")
                        .build(),
                CodeEntityJpaEntity.builder()
                        .entityId(102L)
                        .repositoryId(repoId)
                        .filePath("src/main/java/com/test/Worker.java")
                        .entityType("METHOD")
                        .className("Worker")
                        .methodName("doJob")
                        .docStatus("UNDOCUMENTED")
                        .build()
        );
        when(codeEntityRepository.findCoverageGaps(repoId)).thenReturn(codeEntities);

        // Ready for scan should be TRUE because code entities exist
        DocumentHealthReportResponse report = healthReportService.generateHealthReport(repoId);
        assertNotNull(report);
        assertTrue(report.isReadyForScan());
        assertTrue(report.getHasData());
        assertEquals(0.0, report.getCoveragePercent());
        assertEquals(0.0, report.getFreshnessPercent());
        assertEquals(40L, report.getTotalScannedEntities());
        assertEquals(0L, report.getTotalDocuments());
        // Score: 0*0.4 + 0*0.35 + 100*0.25 = 25.0 -> CRITICAL (D)
        assertNotNull(report.getCompliance());
        assertEquals(25.0, report.getCompliance().getOverallScore());
        assertEquals("CRITICAL (D)", report.getCompliance().getRating());

        // Coverage gaps should contain the 2 entities
        CoverageGapsResponse gaps = healthReportService.getCoverageGaps(repoId);
        assertNotNull(gaps);
        assertEquals(2L, gaps.getTotalMissing());
        assertEquals(1L, gaps.getMissingClasses());
        assertEquals(1L, gaps.getMissingMethods());
        assertEquals(1, gaps.getPackages().size());
        assertEquals("com.test", gaps.getPackages().get(0).getPackageName());

        // Markdown report
        String markdown = healthReportService.exportHealthReportMarkdown(repoId);
        assertNotNull(markdown);
        assertTrue(markdown.contains("code-only-repo"));
        assertTrue(markdown.contains("CRITICAL (D)"));
        assertTrue(markdown.contains("Worker"));
    }

    @Test
    @DisplayName("Edge Case 5: Corrupted entity attributes (null file_path, null types, null class names)")
    void testCorruptedEntityAttributes() {
        Long repoId = 12L;
        when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(
                RepositoryEntity.builder().repositoryId(repoId).repoName("corrupt-repo").build()
        ));
        when(queryPort.countScannedClassesAndFunctions(repoId)).thenReturn(2L);

        List<CodeEntityJpaEntity> corruptedEntities = List.of(
                CodeEntityJpaEntity.builder()
                        .entityId(201L)
                        .repositoryId(repoId)
                        .filePath(null) // null path!
                        .entityType(null) // null type!
                        .className(null) // null class!
                        .methodName(null)
                        .docStatus(null)
                        .build(),
                CodeEntityJpaEntity.builder()
                        .entityId(202L)
                        .repositoryId(repoId)
                        .filePath("") // empty path!
                        .entityType("CUSTOM_TYPE") // unknown type!
                        .className("") // empty class!
                        .methodName("run")
                        .docStatus("UNDOCUMENTED")
                        .build()
        );
        when(codeEntityRepository.findCoverageGaps(repoId)).thenReturn(corruptedEntities);

        assertDoesNotThrow(() -> {
            CoverageGapsResponse gaps = healthReportService.getCoverageGaps(repoId);
            assertNotNull(gaps);
            assertEquals(2L, gaps.getTotalMissing());
            assertEquals(1, gaps.getPackages().size());
            assertEquals("default", gaps.getPackages().get(0).getPackageName());
        });
    }

    @Test
    @DisplayName("Edge Case 6: Excessive critical alerts causes drift penalty > 100")
    void testExtremeAlertPenalties() {
        Long repoId = 13L;
        when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(
                RepositoryEntity.builder().repositoryId(repoId).repoName("extreme-alerts").build()
        ));
        when(queryPort.countScannedClassesAndFunctions(repoId)).thenReturn(10L);
        when(queryPort.countDocumentedEntities(repoId)).thenReturn(10L); // 100%
        when(queryPort.countDocuments(repoId)).thenReturn(10L);
        when(queryPort.countFreshDocuments(repoId)).thenReturn(10L); // 100%

        Map<String, Long> severeAlerts = new LinkedHashMap<>();
        severeAlerts.put("CRITICAL", 10L); // penalty = 10 * 25 = 250!
        when(queryPort.countOpenAlertsBySeverity(repoId)).thenReturn(severeAlerts);
        when(queryPort.countMissingEntitiesByType(repoId)).thenReturn(
                MissingDocEntityStatsDto.builder().missingByType(Collections.emptyMap()).build()
        );

        DocumentHealthReportResponse report = healthReportService.generateHealthReport(repoId);
        assertNotNull(report);
        // driftControlScore should be Math.max(0.0, 100 - 250) = 0.0
        assertEquals(0.0, report.getCompliance().getDriftControlScore());
        // overallScore = 100*0.4 + 100*0.35 + 0*0.25 = 75.0
        assertEquals(75.0, report.getCompliance().getOverallScore());
        // Because critical > 0, rating cannot be EXCELLENT or GOOD despite score >= 75
        assertEquals("MODERATE (B)", report.getCompliance().getRating());
    }

    @Test
    @DisplayName("Edge Case 7: Controller validates parameters and handles formats correctly")
    void testControllerValidationsAndFormats() {
        // 1. Invalid non-positive repositoryId
        assertThrows(IllegalArgumentException.class, () -> controller.getDocumentHealthReport(0L, "json"));
        assertThrows(IllegalArgumentException.class, () -> controller.getDocumentHealthReport(-10L, "markdown"));
        assertThrows(IllegalArgumentException.class, () -> controller.getCoverageGaps(0L));
        assertThrows(IllegalArgumentException.class, () -> controller.getCoverageGaps(-5L));

        // 2. format="md" is accepted as markdown alias
        when(queryPort.countScannedClassesAndFunctions(null)).thenReturn(10L);
        when(queryPort.countDocuments(null)).thenReturn(2L);
        when(queryPort.countMissingEntitiesByType(null)).thenReturn(
                MissingDocEntityStatsDto.builder().missingByType(Collections.emptyMap()).build()
        );
        when(queryPort.countOpenAlertsBySeverity(null)).thenReturn(Collections.emptyMap());

        ResponseEntity<?> responseMd = controller.getDocumentHealthReport(null, "md");
        assertNotNull(responseMd);
        assertEquals(200, responseMd.getStatusCode().value());
        assertTrue(responseMd.getHeaders().getContentType().toString().contains("text/markdown"));
        assertTrue(responseMd.getHeaders().getFirst("Content-Disposition").contains("document-health-report-system.md"));

        // 3. format="markdown" for specific repo
        when(repositoryRepository.findById(5L)).thenReturn(Optional.of(
                RepositoryEntity.builder().repositoryId(5L).repoName("repo-5").build()
        ));
        when(queryPort.countScannedClassesAndFunctions(5L)).thenReturn(0L);
        when(queryPort.countDocuments(5L)).thenReturn(0L);
        when(documentRepository.findByRepoId(5L)).thenReturn(Collections.emptyList());

        ResponseEntity<?> responseRepoMd = controller.getDocumentHealthReport(5L, "markdown");
        assertNotNull(responseRepoMd);
        assertEquals(200, responseRepoMd.getStatusCode().value());
        assertTrue(responseRepoMd.getHeaders().getFirst("Content-Disposition").contains("document-health-report-repo-5.md"));
        assertTrue(responseRepoMd.getBody().toString().contains("repo-5"));
        assertTrue(responseRepoMd.getBody().toString().contains("NOT_CONFIGURED"));
    }
}
