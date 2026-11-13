package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.application.dto.DocumentCrossCheckRequest;
import com.example.livingdocs_backend.application.dto.DocumentCrossCheckResponse;
import com.example.livingdocs_backend.application.dto.DriftAlertSummaryResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.DocTemplateService;
import com.example.livingdocs_backend.application.service.DriftAlertService;
import com.example.livingdocs_backend.application.service.TemplateMarkdownRenderer;
import com.example.livingdocs_backend.application.service.TemplateRuleValidator;
import com.example.livingdocs_backend.application.service.TemplateStructureCheck;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocumentTemplateVersionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocTemplateCrossCheckAndAlertSummaryTest {

    @Mock
    private DocTemplateRepository docTemplateRepository;
    @Mock
    private DocumentTemplateVersionRepository versionRepository;
    @Mock
    private TemplateMarkdownRenderer templateMarkdownRenderer;
    @Mock
    private SpringDataCodeEntityRepository codeEntityRepository;
    @Mock
    private SpringDataDocumentChangeAlertRepository alertRepository;
    @Mock
    private SpringDataDocumentRepository documentRepository;
    @Mock
    private AuditServicePort auditServicePort;

    private ObjectMapper objectMapper;
    private TemplateRuleValidator templateRuleValidator;
    private TemplateStructureCheck templateStructureCheck;
    private DocTemplateService docTemplateService;
    private DriftAlertService driftAlertService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        templateRuleValidator = new TemplateRuleValidator(objectMapper);
        templateStructureCheck = new TemplateStructureCheck(docTemplateRepository, versionRepository, templateRuleValidator);

        docTemplateService = new DocTemplateService(
                docTemplateRepository,
                versionRepository,
                templateMarkdownRenderer,
                templateStructureCheck,
                codeEntityRepository,
                objectMapper
        );

        driftAlertService = new DriftAlertService(
                alertRepository,
                documentRepository,
                auditServicePort
        );
    }

    @Test
    @DisplayName("Chuông thông báo: Lấy tổng số và danh sách cảnh báo sai lệch (Drift Alerts - trạng thái PENDING/OPEN) chưa xử lý")
    void testGetNotificationSummary_ReturnsPendingAndRecentAlerts() {
        DocumentChangeAlertEntity alert1 = DocumentChangeAlertEntity.builder()
                .alertId(101L)
                .repositoryId(1L)
                .documentId(50L)
                .sourceCommit("c89f1a234567")
                .classification("SEMANTIC")
                .severity("HIGH")
                .status("PENDING")
                .details("Commit mới c89f1a2 từ developer: Sửa controller thanh toán")
                .createdAt(Instant.now())
                .build();

        DocumentEntity doc = DocumentEntity.builder()
                .docId(50L)
                .title("Tài liệu Thanh Toán API")
                .build();

        when(alertRepository.countByStatusInIgnoreCase(anyList())).thenReturn(1L);
        when(alertRepository.findTop10ByStatusInIgnoreCaseOrderByCreatedAtDesc(anyList())).thenReturn(List.of(alert1));
        when(documentRepository.findById(50L)).thenReturn(Optional.of(doc));

        DriftAlertSummaryResponse summary = driftAlertService.getNotificationSummary(null);

        assertNotNull(summary);
        assertEquals(1L, summary.getPendingCount());
        assertEquals(1, summary.getRecentAlerts().size());

        var item = summary.getRecentAlerts().get(0);
        assertEquals(101L, item.getAlertId());
        assertEquals("HIGH", item.getSeverity());
        assertEquals("PENDING", item.getStatus());
        assertEquals("Tài liệu Thanh Toán API", item.getDocumentTitle());
        assertEquals("c89f1a2", item.getSourceCommit());
        assertEquals("/canh-bao-sai-lech?alertId=101&docId=50", item.getSuggestionUrl());
    }

    @Test
    @DisplayName("Chuông thông báo: Khi không có cảnh báo PENDING/OPEN thì pendingCount=0 và recentAlerts rỗng")
    void testGetNotificationSummary_WhenZeroPending_ReturnsEmptyRecentAlerts() {
        when(alertRepository.countByStatusInIgnoreCase(anyList())).thenReturn(0L);
        when(alertRepository.findTop10ByStatusInIgnoreCaseOrderByCreatedAtDesc(anyList())).thenReturn(List.of());

        DriftAlertSummaryResponse summary = driftAlertService.getNotificationSummary(null);

        assertNotNull(summary);
        assertEquals(0L, summary.getPendingCount());
        assertTrue(summary.getRecentAlerts().isEmpty(), "Không được trả về cảnh báo đã resolved khi số đếm pending=0");
    }

    @Test
    @DisplayName("Đối chiếu 2 chiều: Quét đề mục Template và Code Entities phát hiện thiếu sót chính xác")
    void testCrossCheck_TemplateAndCodeEntitiesGaps() {
        String structureJson = "{\"sections\":[{\"key\":\"overview\",\"title\":\"Giới thiệu tổng quan\",\"level\":2,\"required\":true},{\"key\":\"endpoints\",\"title\":\"Danh sách Endpoint\",\"level\":2,\"required\":true}]}";
        DocTemplate template = DocTemplate.builder()
                .id(1L)
                .name("API Reference Standard")
                .type("API_REFERENCE")
                .structureJson(structureJson)
                .isDefault(true)
                .build();

        when(docTemplateRepository.findById(1L)).thenReturn(Optional.of(template));

        CodeEntityJpaEntity controllerEntity = CodeEntityJpaEntity.builder()
                .entityId(201L)
                .repositoryId(1L)
                .filePath("src/main/java/com/example/OrderController.java")
                .className("OrderController")
                .entityType("CLASS")
                .methodName("createOrder")
                .signature("ResponseEntity<OrderDto> createOrder(OrderRequest req)")
                .build();

        CodeEntityJpaEntity serviceEntity = CodeEntityJpaEntity.builder()
                .entityId(202L)
                .repositoryId(1L)
                .filePath("src/main/java/com/example/OrderService.java")
                .className("OrderService")
                .entityType("CLASS")
                .methodName("processOrder")
                .signature("Order processOrder(Long id)")
                .build();

        when(codeEntityRepository.findByRepositoryId(1L)).thenReturn(List.of(controllerEntity, serviceEntity));

        // Markdown chỉ có mục 1, thiếu mục 2 "Danh sách Endpoint", và chỉ nhắc tới OrderService, chưa nhắc tới OrderController
        String sampleMarkdown = "# Tài liệu Đơn Hàng\n\n## Giới thiệu tổng quan\nTài liệu hệ thống sử dụng OrderService để xử lý đơn.";

        DocumentCrossCheckRequest request = DocumentCrossCheckRequest.builder()
                .templateId(1L)
                .repositoryId(1L)
                .markdown(sampleMarkdown)
                .build();

        DocumentCrossCheckResponse response = docTemplateService.crossCheck(request);

        assertNotNull(response);
        assertEquals(1L, response.getTemplateId());
        assertFalse(response.isTemplateValid()); // thiếu "Danh sách Endpoint"

        assertTrue(response.getMissingTemplateHeadings().stream().anyMatch(h -> h.contains("Danh sách Endpoint")));

        // Kiểm tra Code entities: OrderController bị thiếu trong markdown
        assertEquals(2, response.getTotalCodeEntities());
        assertEquals(1, response.getDocumentedCodeEntities()); // OrderService được đề cập
        assertEquals(1, response.getMissingCodeEntitiesCount()); // OrderController bị thiếu

        var missingCode = response.getMissingCodeEntities().get(0);
        assertEquals("OrderController", missingCode.getClassName());
        assertEquals("Controller", missingCode.getEntityType());
        assertNotNull(missingCode.getSuggestedMarkdown());
        assertTrue(missingCode.getSuggestedMarkdown().contains("OrderController"));

        // Kiểm tra danh sách suggestions gợi ý
        assertFalse(response.getSuggestions().isEmpty());
    }
}
