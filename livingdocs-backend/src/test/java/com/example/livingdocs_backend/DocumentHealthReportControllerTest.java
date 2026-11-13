package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.health.CoverageGapClassDto;
import com.example.livingdocs_backend.application.dto.health.CoverageGapItemDto;
import com.example.livingdocs_backend.application.dto.health.CoverageGapPackageDto;
import com.example.livingdocs_backend.application.dto.health.CoverageGapsResponse;
import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.port.DocumentHealthReportServicePort;
import com.example.livingdocs_backend.infrastructure.web.controller.DocumentHealthReportController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentHealthReportControllerTest {

    private DocumentHealthReportServicePort servicePort;
    private DocumentHealthReportController controller;

    @BeforeEach
    void setUp() {
        servicePort = mock(DocumentHealthReportServicePort.class);
        controller = new DocumentHealthReportController(servicePort);
    }

    @Test
    void getDocumentHealthReportExportsMarkdown() {
        String markdownContent = "# 📊 Báo Cáo Tình Trạng Sức Khỏe Tài Liệu\n\n| Chỉ số | Điểm số |\n|---|---|\n| Bao phủ | 85.0% |";
        when(servicePort.exportHealthReportMarkdown(1L)).thenReturn(markdownContent);

        ResponseEntity<?> response = controller.getDocumentHealthReport(1L, "markdown");

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getContentType().toString().contains("text/markdown"));
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("document-health-report-repo-1.md"));
        assertEquals(markdownContent, response.getBody());
    }

    @Test
    void getDocumentHealthReportReturnsJsonResponseByDefault() {
        DocumentHealthReportResponse report = DocumentHealthReportResponse.builder()
                .repositoryId(1L)
                .coveragePercent(85.0)
                .build();
        when(servicePort.generateHealthReport(1L)).thenReturn(report);

        ResponseEntity<?> response = controller.getDocumentHealthReport(1L, "json");

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(report, response.getBody());
    }

    @Test
    void getCoverageGapsReturnsGroupedData() {
        CoverageGapsResponse mockResponse = CoverageGapsResponse.builder()
                .repositoryId(1L)
                .repositoryName("livingdocs-backend")
                .totalMissing(2L)
                .missingClasses(1L)
                .missingMethods(1L)
                .packages(List.of(
                        CoverageGapPackageDto.builder()
                                .packageName("com.example.service")
                                .totalMissing(2)
                                .classes(List.of(
                                        CoverageGapClassDto.builder()
                                                .className("UserService")
                                                .filePath("src/main/java/com/example/UserService.java")
                                                .entityType("CLASS")
                                                .totalMissing(2)
                                                .methods(List.of(
                                                        CoverageGapItemDto.builder()
                                                                .entityId(10L)
                                                                .methodName("createUser")
                                                                .entityType("METHOD")
                                                                .build()
                                                ))
                                                .build()
                                ))
                                .build()
                ))
                .items(List.of(
                        CoverageGapItemDto.builder()
                                .entityId(9L)
                                .className("UserService")
                                .entityType("CLASS")
                                .build(),
                        CoverageGapItemDto.builder()
                                .entityId(10L)
                                .className("UserService")
                                .methodName("createUser")
                                .entityType("METHOD")
                                .build()
                ))
                .build();

        when(servicePort.getCoverageGaps(1L)).thenReturn(mockResponse);

        ResponseEntity<CoverageGapsResponse> response = controller.getCoverageGaps(1L);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(mockResponse, response.getBody());
        assertEquals(2L, response.getBody().getTotalMissing());
        assertEquals(1, response.getBody().getPackages().size());
        verify(servicePort).getCoverageGaps(1L);
    }

    @Test
    void throwsExceptionWhenRepositoryIdIsInvalid() {
        assertThrows(IllegalArgumentException.class, () -> controller.getDocumentHealthReport(0L, "json"));
        assertThrows(IllegalArgumentException.class, () -> controller.getCoverageGaps(-1L));
    }
}
