package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.RepoCoverageDto;
import com.example.livingdocs_backend.application.dto.health.CoverageGapsResponse;
import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import com.example.livingdocs_backend.application.service.DocumentHealthReportServiceImpl;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DocumentHealthReportServiceTest {

    private DashboardStatsQueryPort queryPort;
    private SpringDataRepositoryRepository repositoryRepository;
    private SpringDataCodeEntityRepository codeEntityRepository;
    private DocumentHealthReportServiceImpl healthReportService;

    @BeforeEach
    void setUp() {
        queryPort = mock(DashboardStatsQueryPort.class);
        repositoryRepository = mock(SpringDataRepositoryRepository.class);
        codeEntityRepository = mock(SpringDataCodeEntityRepository.class);
        healthReportService = new DocumentHealthReportServiceImpl(queryPort, repositoryRepository, codeEntityRepository);
    }

    @Test
    void generatesComprehensiveHealthReportForSystem() {
        when(queryPort.countScannedClassesAndFunctions(null)).thenReturn(100L);
        when(queryPort.countDocumentedEntities(null)).thenReturn(85L);
        when(queryPort.countDocuments(null)).thenReturn(20L);
        when(queryPort.countFreshDocuments(null)).thenReturn(18L);
        when(queryPort.findLatestCommitAt(null)).thenReturn(Optional.of(Instant.parse("2026-11-10T10:00:00Z")));

        Map<String, Long> missingByType = new LinkedHashMap<>();
        missingByType.put("CLASS", 3L);
        missingByType.put("METHOD", 12L);
        missingByType.put("FUNCTION", 0L);
        MissingDocEntityStatsDto missingDto = MissingDocEntityStatsDto.builder()
                .totalMissing(15L)
                .missingClasses(3L)
                .missingMethodsAndFunctions(12L)
                .missingByType(missingByType)
                .build();
        when(queryPort.countMissingEntitiesByType(null)).thenReturn(missingDto);

        Map<String, Long> alerts = new LinkedHashMap<>();
        alerts.put("LOW", 2L);
        alerts.put("MEDIUM", 1L);
        alerts.put("HIGH", 0L);
        alerts.put("CRITICAL", 0L);
        when(queryPort.countOpenAlertsBySeverity(null)).thenReturn(alerts);

        when(queryPort.findRepoCoverages()).thenReturn(List.of(
                RepoCoverageDto.builder()
                        .repoId(1L)
                        .repoName("backend-repo")
                        .coveragePercent(85.0)
                        .totalEntities(100L)
                        .documentedEntities(85L)
                        .openDriftCount(3L)
                        .build()
        ));

        DocumentHealthReportResponse report = healthReportService.generateHealthReport(null);

        assertNotNull(report);
        assertEquals(85.0, report.getCoveragePercent());
        assertEquals(90.0, report.getFreshnessPercent());
        assertEquals(100L, report.getTotalScannedEntities());
        assertEquals(85L, report.getDocumentedEntities());
        assertEquals(15L, report.getMissingDocEntities().getTotalMissing());
        assertEquals(3L, report.getMissingDocEntities().getMissingClasses());
        assertEquals(12L, report.getMissingDocEntities().getMissingMethodsAndFunctions());
        assertEquals(3L, report.getTotalOpenDriftAlerts());
        assertNotNull(report.getCompliance());
        assertTrue(report.getCompliance().getOverallScore() >= 80.0);
        assertTrue(report.getExecutionTimeMs() < 300); // Tiêu chuẩn phản hồi dưới 300ms
    }

    @Test
    void exportsHealthReportInMarkdownFormatWithTables() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(
                RepositoryEntity.builder()
                        .repositoryId(1L)
                        .repoName("my-awesome-repo")
                        .build()
        ));

        when(queryPort.countScannedClassesAndFunctions(1L)).thenReturn(50L);
        when(queryPort.countDocumentedEntities(1L)).thenReturn(40L);
        when(queryPort.countDocuments(1L)).thenReturn(10L);
        when(queryPort.countFreshDocuments(1L)).thenReturn(8L);
        when(queryPort.findLatestCommitAt(1L)).thenReturn(Optional.of(Instant.parse("2026-11-10T10:00:00Z")));

        Map<String, Long> missingByType = new LinkedHashMap<>();
        missingByType.put("CLASS", 2L);
        missingByType.put("METHOD", 8L);
        missingByType.put("FUNCTION", 0L);
        when(queryPort.countMissingEntitiesByType(1L)).thenReturn(
                MissingDocEntityStatsDto.builder()
                        .totalMissing(10L)
                        .missingClasses(2L)
                        .missingMethodsAndFunctions(8L)
                        .missingByType(missingByType)
                        .build()
        );

        Map<String, Long> alerts = new LinkedHashMap<>();
        alerts.put("LOW", 1L);
        alerts.put("MEDIUM", 0L);
        alerts.put("HIGH", 0L);
        alerts.put("CRITICAL", 0L);
        when(queryPort.countOpenAlertsBySeverity(1L)).thenReturn(alerts);

        String markdown = healthReportService.exportHealthReportMarkdown(1L);

        assertNotNull(markdown);
        assertTrue(markdown.contains("# 📊 Báo Cáo Tình Trạng Sức Khỏe Tài Liệu"));
        assertTrue(markdown.contains("my-awesome-repo"));
        assertTrue(markdown.contains("Tỷ lệ bao phủ mã nguồn"));
        assertTrue(markdown.contains("80.00%"));
        assertTrue(markdown.contains("Thống Kê Hàm & Lớp Còn Thiếu Tài Liệu"));
        assertTrue(markdown.contains("CRITICAL"));
        assertTrue(markdown.contains("Đánh Giá Mức Độ Tuân Thủ"));
    }

    @Test
    void queriesCoverageGapsGroupedByPackageClassAndMethod() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(
                RepositoryEntity.builder()
                        .repositoryId(1L)
                        .repoName("livingdocs-backend")
                        .build()
        ));

        List<CodeEntityJpaEntity> mockEntities = List.of(
                CodeEntityJpaEntity.builder()
                        .entityId(101L)
                        .repositoryId(1L)
                        .filePath("src/main/java/com/example/livingdocs_backend/domain/model/Document.java")
                        .entityType("CLASS")
                        .className("Document")
                        .docStatus("UNDOCUMENTED")
                        .startLine(10)
                        .endLine(80)
                        .build(),
                CodeEntityJpaEntity.builder()
                        .entityId(102L)
                        .repositoryId(1L)
                        .filePath("src/main/java/com/example/livingdocs_backend/domain/model/Document.java")
                        .entityType("METHOD")
                        .className("Document")
                        .methodName("publish")
                        .signature("public void publish(String publisher)")
                        .docStatus("UNDOCUMENTED")
                        .startLine(45)
                        .endLine(55)
                        .build(),
                CodeEntityJpaEntity.builder()
                        .entityId(103L)
                        .repositoryId(1L)
                        .filePath("src/main/java/com/example/livingdocs_backend/infrastructure/web/controller/UserController.java")
                        .entityType("METHOD")
                        .className("UserController")
                        .methodName("getProfile")
                        .signature("public ResponseEntity<?> getProfile()")
                        .docStatus("UNDOCUMENTED")
                        .startLine(30)
                        .endLine(40)
                        .build()
        );

        when(codeEntityRepository.findCoverageGaps(1L)).thenReturn(mockEntities);

        CoverageGapsResponse response = healthReportService.getCoverageGaps(1L);

        assertNotNull(response);
        assertEquals(1L, response.getRepositoryId());
        assertEquals("livingdocs-backend", response.getRepositoryName());
        assertEquals(3L, response.getTotalMissing());
        assertEquals(1L, response.getMissingClasses());
        assertEquals(2L, response.getMissingMethods());
        assertEquals(3, response.getItems().size());

        // Kiểm tra phân nhóm theo 2 packages
        assertEquals(2, response.getPackages().size());
        assertEquals("com.example.livingdocs_backend.domain.model", response.getPackages().get(0).getPackageName());
        assertEquals(2, response.getPackages().get(0).getTotalMissing());
        assertEquals(1, response.getPackages().get(0).getClasses().size());
        assertEquals("Document", response.getPackages().get(0).getClasses().get(0).getClassName());
        assertEquals(1, response.getPackages().get(0).getClasses().get(0).getMethods().size());

        assertEquals("com.example.livingdocs_backend.infrastructure.web.controller", response.getPackages().get(1).getPackageName());
        assertEquals(1, response.getPackages().get(1).getTotalMissing());
    }
}
