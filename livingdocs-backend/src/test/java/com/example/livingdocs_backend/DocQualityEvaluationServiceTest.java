package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationRequest;
import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationResponse;
import com.example.livingdocs_backend.application.service.DocQualityEvaluationServiceImpl;
import com.example.livingdocs_backend.application.service.PrMergeBlockingServiceImpl;
import com.example.livingdocs_backend.application.service.TemplateStructureCheck;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocQualityEvaluationServiceTest {

    @Mock
    private SpringDataCodeEntityRepository codeEntityRepository;

    @Mock
    private DocTemplateRepository docTemplateRepository;

    @Mock
    private TemplateStructureCheck templateStructureCheck;

    @Mock
    private DocumentRepositoryPort documentRepositoryPort;

    @Mock
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;

    @Mock
    private SpringDataRepositoryRepository repositoryRepository;

    @Mock
    private PrMergeBlockingServiceImpl prMergeBlockingService;

    @InjectMocks
    private DocQualityEvaluationServiceImpl qualityEvaluationService;

    private RepositoryEntity mockRepo;
    private List<CodeEntityJpaEntity> mockEntities;

    @BeforeEach
    void setUp() {
        mockRepo = RepositoryEntity.builder()
                .repositoryId(1L)
                .workspaceId(1L)
                .connectionId(1L)
                .githubRepoId(12345L)
                .repoName("Java_UTH")
                .repoFullName("LeNgocChau9/Java_UTH")
                .build();

        CodeEntityJpaEntity entity1 = CodeEntityJpaEntity.builder()
                .entityId(101L)
                .repositoryId(1L)
                .entityType("SERVICE")
                .className("PaymentService")
                .methodName("processOrderPayment")
                .signature("public PaymentResult processOrderPayment(Long orderId, Double amount)")
                .filePath("src/main/java/com/example/service/PaymentService.java")
                .parameters("Long orderId, Double amount")
                .build();

        CodeEntityJpaEntity entity2 = CodeEntityJpaEntity.builder()
                .entityId(102L)
                .repositoryId(1L)
                .entityType("CONTROLLER")
                .className("PaymentController")
                .methodName("handleCheckout")
                .signature("public ResponseEntity<?> handleCheckout(CheckoutRequest request)")
                .filePath("src/main/java/com/example/controller/PaymentController.java")
                .parameters("CheckoutRequest request")
                .build();

        mockEntities = List.of(entity1, entity2);
    }

    @Test
    @DisplayName("Thẩm định tài liệu chuẩn: Khớp AST, không ảo giác -> PR Gate PASSED")
    void testEvaluateQuality_Passed_NoHallucinations() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(mockRepo));
        when(codeEntityRepository.findByRepositoryId(1L)).thenReturn(mockEntities);

        String validMarkdown = """
                # Hướng dẫn thanh toán PaymentService
                
                ## 1. Tổng quan
                Dịch vụ `PaymentService` chịu trách nhiệm xử lý các giao dịch.
                
                ## 2. API & Phương thức
                - Phương thức `processOrderPayment(orderId, amount)` nhận vào `orderId` và `amount`.
                - Controller `PaymentController` cung cấp `handleCheckout` để nhận `request`.
                
                ## 3. Kiến trúc
                Sử dụng `ResponseEntity` và Spring `@Service` chuẩn mực.
                """;

        DocumentQualityEvaluationRequest request = DocumentQualityEvaluationRequest.builder()
                .repositoryId(1L)
                .filePath("src/main/java/com/example/service/PaymentService.java")
                .markdown(validMarkdown)
                .minQualityThreshold(0.70)
                .minAntiHallucinationThreshold(0.80)
                .build();

        DocumentQualityEvaluationResponse response = qualityEvaluationService.evaluateQuality(request);

        assertNotNull(response);
        assertEquals(1L, response.getRepositoryId());
        assertEquals("PASSED", response.getPrGateStatus());
        assertTrue(response.getPassed());
        assertEquals(0, response.getPhantomSymbolsCount());
        assertEquals(100.0, response.getAntiHallucinationPercent());
        assertTrue(response.getOverallQualityScore() >= 70.0);
    }

    @Test
    @DisplayName("Phát hiện ảo giác AI (Phantom Symbols): Hàm và API giả mạo -> PR Gate BLOCKED")
    void testEvaluateQuality_Blocked_WithPhantomSymbols() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(mockRepo));
        when(codeEntityRepository.findByRepositoryId(1L)).thenReturn(mockEntities);

        String hallucinatedMarkdown = """
                # Hướng dẫn thanh toán PaymentService
                
                ## 1. Phương thức ảo giác do AI tự bịa
                Hệ thống cung cấp hàm `calculateSecretBackdoorDiscount(userToken)` để giảm 90% giá trị.
                Ngoài ra có thể gọi API giả `/api/v1/internal-crypto-vault/hack` để rút tiền.
                Gọi `PaymentService` để xử lý.
                """;

        DocumentQualityEvaluationRequest request = DocumentQualityEvaluationRequest.builder()
                .repositoryId(1L)
                .filePath("src/main/java/com/example/service/PaymentService.java")
                .markdown(hallucinatedMarkdown)
                .minQualityThreshold(0.75)
                .minAntiHallucinationThreshold(0.80)
                .build();

        DocumentQualityEvaluationResponse response = qualityEvaluationService.evaluateQuality(request);

        assertNotNull(response);
        assertEquals("BLOCKED", response.getPrGateStatus());
        assertFalse(response.getPassed());
        assertTrue(response.getPhantomSymbolsCount() >= 1);
        assertTrue(response.getAntiHallucinationPercent() < 80.0);

        // Kiểm tra danh sách Phantom Symbols chứa ký hiệu bịa
        boolean foundSecretBackdoor = response.getPhantomSymbols().stream()
                .anyMatch(p -> p.getSymbol().contains("calculateSecretBackdoorDiscount") || p.getSymbol().contains("internal-crypto-vault"));
        assertTrue(foundSecretBackdoor, "Phải bắt được Phantom Symbol bịa đặt");
    }

    @Test
    @DisplayName("Phát hiện thiếu thực thể và tham số code thật từ AST")
    void testEvaluateQuality_DetectsMissingEntitiesAndParams() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(mockRepo));
        when(codeEntityRepository.findByRepositoryId(1L)).thenReturn(mockEntities);

        // Markdown chỉ đề cập PaymentService chung chung, không có processOrderPayment hay handleCheckout
        String minimalMarkdown = """
                # Giới thiệu sơ lược
                Đây là mô tả chung chung về hệ thống thanh toán không có bất kỳ tên hàm nào.
                """;

        DocumentQualityEvaluationRequest request = DocumentQualityEvaluationRequest.builder()
                .repositoryId(1L)
                .filePath("src/main/java/com/example/service/PaymentService.java")
                .markdown(minimalMarkdown)
                .minQualityThreshold(0.75)
                .build();

        DocumentQualityEvaluationResponse response = qualityEvaluationService.evaluateQuality(request);

        assertNotNull(response);
        assertEquals(2, response.getMissingCodeEntitiesCount());
        assertFalse(response.getMissingEntities().isEmpty());
    }
}
