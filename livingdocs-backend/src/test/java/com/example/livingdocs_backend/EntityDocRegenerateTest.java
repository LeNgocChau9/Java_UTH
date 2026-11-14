package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.code.EntityDocRegenerateRequestDto;
import com.example.livingdocs_backend.application.dto.code.EntityDocRegenerateResponseDto;
import com.example.livingdocs_backend.application.service.CodeIndexService;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.util.HashUtils;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.web.controller.CodeIndexController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EntityDocRegenerateTest {

    @Mock
    private CodeEntityRepositoryPort codeEntityRepository;

    @Mock
    private DocumentRepositoryPort documentRepositoryPort;

    @Mock
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;

    @Mock
    private SpringDataDocCodeLinkRepository docCodeLinkRepository;

    private CodeIndexService codeIndexService;
    private CodeIndexController codeIndexController;

    @BeforeEach
    void setUp() {
        codeIndexService = new CodeIndexService(
                codeEntityRepository,
                documentRepositoryPort,
                documentVersionRepositoryPort,
                docCodeLinkRepository,
                "http://localhost:19999");
        codeIndexController = new CodeIndexController(codeIndexService);
    }

    @Test
    @DisplayName("Tạo lại tài liệu cho một phương thức cụ thể: Chỉ cập nhật đúng section của phương thức đó, giữ nguyên các section đã duyệt khác và lưu phiên bản DRAFT mới")
    void shouldRegenerateOnlyTargetMethodSectionAndPreserveOtherApprovedSectionsInNewDraftVersion() {
        Long repoId = 10L;
        Long docId = 50L;
        Long entityId = 102L;
        String filePath = "src/main/java/com/example/payment/PaymentService.java";

        String approvedOverviewSection = """
                # Tài liệu Kỹ thuật: PaymentService

                ## 1. Tổng quan Dịch vụ Thanh toán
                Dịch vụ `PaymentService` xử lý toàn bộ giao dịch thanh toán, xác thực thẻ và hoàn tiền.
                Mục này đã được Trưởng nhóm kỹ thuật và Quản lý phê duyệt.""";

        String approvedValidateSection = """
                ### validatePaymentCard
                - **Phân loại:** `METHOD` (Lớp: `PaymentService`)
                - **Chữ ký (Signature):** `public boolean validatePaymentCard(String cardNumber, String cvv)`
                - **Mô tả kỹ thuật:** Kiểm tra tính hợp lệ của số thẻ theo thuật toán Luhn. Đã được phê duyệt chính thức.""";

        String outdatedProcessSection = """
                ### processPayment
                - **Phân loại:** `METHOD` (Lớp: `PaymentService`)
                - **Chữ ký (Signature):** `public void processPayment(Long orderId, Double amount)`
                - **Tham số (Parameters):** `Long orderId, Double amount`
                - **Mô tả kỹ thuật:** Mô tả cũ từ phiên bản trước khi hỗ trợ đa tiền tệ.""";

        String approvedRefundSection = """
                ### refundPayment
                - **Phân loại:** `METHOD` (Lớp: `PaymentService`)
                - **Chữ ký (Signature):** `public RefundReceipt refundPayment(Long transactionId, String reason)`
                - **Mô tả kỹ thuật:** Hoàn tiền giao dịch về tài khoản gốc của khách hàng. Đã được phê duyệt chính thức.""";

        String approvedSecuritySection = """
                ## 3. Chính sách Bảo mật PCI-DSS
                Toàn bộ thông tin thẻ không được ghi vào log hệ thống và phải mã hóa chuẩn AES-256.""";

        String existingMultiSectionMarkdown = String.join("\n\n",
                approvedOverviewSection,
                "## 2. Danh mục Phương thức",
                approvedValidateSection,
                outdatedProcessSection,
                approvedRefundSection,
                approvedSecuritySection);

        CodeEntity outdatedMethodEntity = CodeEntity.builder()
                .entityId(entityId)
                .repositoryId(repoId)
                .filePath(filePath)
                .entityType("METHOD")
                .className("PaymentService")
                .methodName("processPayment")
                .signature("public void processPayment(Long orderId, Double amount)")
                .returnType("void")
                .parameters("Long orderId, Double amount")
                .startLine(45)
                .endLine(72)
                .commitHash("commit-v2")
                .docStatus("OUTDATED")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        Document existingDoc = Document.builder()
                .docId(docId)
                .repoId(repoId)
                .title("Tài liệu Kỹ thuật - PaymentService")
                .targetPath("docs/files/" + filePath + ".md")
                .status(DocumentStatus.PUBLISHED)
                .currentVersion(2)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        String v2Hash = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 2, existingMultiSectionMarkdown, "MANAGER", "APPROVED");

        DocumentVersion latestVersionV2 = DocumentVersion.builder()
                .versionId(200L)
                .docId(docId)
                .versionNum(2)
                .content(existingMultiSectionMarkdown)
                .hash(v2Hash)
                .prevHash(HashUtils.GENESIS_HASH)
                .createdAt(Instant.now())
                .build();

        when(codeEntityRepository.findByRepositoryIdAndFilePath(repoId, filePath))
                .thenReturn(List.of(outdatedMethodEntity));
        when(codeEntityRepository.save(any(CodeEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(documentRepositoryPort.findByRepoId(repoId))
                .thenReturn(List.of(existingDoc));
        when(documentRepositoryPort.save(any(Document.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId))
                .thenReturn(Optional.of(latestVersionV2));
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class)))
                .thenAnswer(inv -> {
                    DocumentVersion v = inv.getArgument(0);
                    v.setVersionId(201L);
                    return v;
                });

        EntityDocRegenerateRequestDto request = EntityDocRegenerateRequestDto.builder()
                .entityId(entityId)
                .repositoryId(repoId)
                .filePath(filePath)
                .entityType("METHOD")
                .className("PaymentService")
                .methodName("processPayment")
                .signature("public PaymentResult processPayment(Long orderId, BigDecimal amount, String currency)")
                .returnType("PaymentResult")
                .parameters("Long orderId, BigDecimal amount, String currency")
                .startLine(45)
                .endLine(84)
                .javadoc("/** Thực thi thanh toán đơn hàng hỗ trợ đa tiền tệ theo chuẩn ISO-4217. */")
                .sourceCode("public PaymentResult processPayment(Long orderId, BigDecimal amount, String currency) {\n    return gateway.charge(orderId, amount, currency);\n}")
                .commitHash("commit-v3")
                .instruction("Bổ sung mô tả tham số currency và kiểu trả về PaymentResult")
                .build();

        // Act
        ResponseEntity<EntityDocRegenerateResponseDto> httpResp = codeIndexController.regenerateDocByEntityId(entityId, request);
        EntityDocRegenerateResponseDto response = httpResp.getBody();

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getDocumentId()).isEqualTo(docId);
        assertThat(response.getVersionId()).isEqualTo(201L);
        assertThat(response.getVersionNumber()).isEqualTo(3);
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getDocStatus()).isEqualTo("DOCUMENTED");
        assertThat(response.getPreviousHash()).isEqualTo(v2Hash);
        assertThat(response.getContentHash()).isNotBlank().isNotEqualTo(v2Hash);

        // Kiểm tra section mới của processPayment đã được cập nhật theo AST mới
        assertThat(response.getUpdatedSectionMarkdown())
                .contains("### processPayment")
                .contains("public PaymentResult processPayment(Long orderId, BigDecimal amount, String currency)")
                .contains("Long orderId, BigDecimal amount, String currency")
                .contains("PaymentResult")
                .contains("Thực thi thanh toán đơn hàng hỗ trợ đa tiền tệ theo chuẩn ISO-4217");

        // Kiểm tra tài liệu tổng thể: section cũ của processPayment đã được thay thế
        String fullUpdated = response.getFullMarkdown();
        assertThat(fullUpdated)
                .contains("public PaymentResult processPayment(Long orderId, BigDecimal amount, String currency)")
                .doesNotContain("public void processPayment(Long orderId, Double amount)")
                .doesNotContain("Mô tả cũ từ phiên bản trước khi hỗ trợ đa tiền tệ.");

        // Kiểm tra TẤT CẢ các section đã phê duyệt khác được giữ nguyên 100%
        assertThat(fullUpdated).contains(approvedOverviewSection);
        assertThat(fullUpdated).contains(approvedValidateSection);
        assertThat(fullUpdated).contains(approvedRefundSection);
        assertThat(fullUpdated).contains(approvedSecuritySection);

        // Kiểm tra Document và DocumentVersion được lưu đúng trạng thái DRAFT v3
        ArgumentCaptor<Document> docCaptor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepositoryPort).save(docCaptor.capture());
        assertThat(docCaptor.getValue().getStatus()).isEqualTo(DocumentStatus.DRAFT);
        assertThat(docCaptor.getValue().getCurrentVersion()).isEqualTo(3);

        ArgumentCaptor<DocumentVersion> versionCaptor = ArgumentCaptor.forClass(DocumentVersion.class);
        verify(documentVersionRepositoryPort).save(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getVersionNum()).isEqualTo(3);
        assertThat(versionCaptor.getValue().getPrevHash()).isEqualTo(v2Hash);
        assertThat(versionCaptor.getValue().getContent()).isEqualTo(fullUpdated);

        ArgumentCaptor<CodeEntity> entityCaptor = ArgumentCaptor.forClass(CodeEntity.class);
        verify(codeEntityRepository).save(entityCaptor.capture());
        assertThat(entityCaptor.getValue().getDocStatus()).isEqualTo("DOCUMENTED");
    }

    @Test
    @DisplayName("Nối thêm section mới vào cuối tài liệu nếu phương thức chưa có mục riêng trong tài liệu hiện tại")
    void shouldAppendNewSectionWhenEntityNotYetPresentInExistingDocument() {
        Long repoId = 10L;
        Long docId = 60L;
        String filePath = "src/main/java/com/example/order/OrderService.java";

        String existingMarkdown = """
                # Tài liệu Kỹ thuật: OrderService

                ## 1. Tổng quan
                Quản lý đơn hàng.

                ### createOrder
                - **Chữ ký (Signature):** `public Order createOrder(OrderRequest req)`
                - **Mô tả kỹ thuật:** Tạo đơn hàng mới.""";

        Document existingDoc = Document.builder()
                .docId(docId)
                .repoId(repoId)
                .title("Tài liệu Kỹ thuật - OrderService")
                .targetPath("docs/files/" + filePath + ".md")
                .status(DocumentStatus.PUBLISHED)
                .currentVersion(1)
                .build();

        DocumentVersion v1 = DocumentVersion.builder()
                .versionId(300L)
                .docId(docId)
                .versionNum(1)
                .content(existingMarkdown)
                .hash("hash-v1")
                .prevHash(HashUtils.GENESIS_HASH)
                .build();

        when(codeEntityRepository.findByRepositoryIdAndFilePath(repoId, filePath))
                .thenReturn(Collections.emptyList());
        when(codeEntityRepository.save(any(CodeEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(documentRepositoryPort.findByRepoId(repoId))
                .thenReturn(List.of(existingDoc));
        when(documentRepositoryPort.save(any(Document.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId))
                .thenReturn(Optional.of(v1));
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class)))
                .thenAnswer(inv -> {
                    DocumentVersion v = inv.getArgument(0);
                    v.setVersionId(301L);
                    return v;
                });

        EntityDocRegenerateRequestDto request = EntityDocRegenerateRequestDto.builder()
                .repositoryId(repoId)
                .filePath(filePath)
                .entityType("METHOD")
                .className("OrderService")
                .methodName("archiveExpiredOrders")
                .signature("public int archiveExpiredOrders(Instant cutoffTime)")
                .returnType("int")
                .parameters("Instant cutoffTime")
                .startLine(80)
                .endLine(105)
                .build();

        EntityDocRegenerateResponseDto res = codeIndexController.regenerateDoc(request).getBody();

        assertThat(res).isNotNull();
        assertThat(res.getVersionNumber()).isEqualTo(2);
        assertThat(res.getStatus()).isEqualTo("DRAFT");
        assertThat(res.getFullMarkdown())
                .startsWith(existingMarkdown)
                .contains("### archiveExpiredOrders")
                .contains("public int archiveExpiredOrders(Instant cutoffTime)");
    }

    @Test
    @DisplayName("Tự động khởi tạo tài liệu nháp v1 (DRAFT) nếu tệp mã nguồn chưa có tài liệu trước đó")
    void shouldCreateInitialDraftDocumentWhenNoDocumentExistsForFile() {
        Long repoId = 20L;
        String filePath = "src/main/java/com/example/inventory/StockValidator.java";

        when(codeEntityRepository.findByRepositoryIdAndFilePath(repoId, filePath))
                .thenReturn(Collections.emptyList());
        when(codeEntityRepository.save(any(CodeEntity.class)))
                .thenAnswer(inv -> {
                    CodeEntity ce = inv.getArgument(0);
                    ce.setEntityId(501L);
                    return ce;
                });
        when(documentRepositoryPort.findByRepoId(repoId))
                .thenReturn(Collections.emptyList());
        when(documentRepositoryPort.findAll())
                .thenReturn(Collections.emptyList());
        when(documentRepositoryPort.save(any(Document.class)))
                .thenAnswer(inv -> {
                    Document d = inv.getArgument(0);
                    d.setDocId(99L);
                    return d;
                });
        when(documentVersionRepositoryPort.save(any(DocumentVersion.class)))
                .thenAnswer(inv -> {
                    DocumentVersion v = inv.getArgument(0);
                    v.setVersionId(401L);
                    return v;
                });

        EntityDocRegenerateRequestDto request = EntityDocRegenerateRequestDto.builder()
                .repositoryId(repoId)
                .filePath(filePath)
                .entityType("CLASS")
                .className("StockValidator")
                .signature("public class StockValidator")
                .startLine(1)
                .endLine(60)
                .build();

        EntityDocRegenerateResponseDto res = codeIndexController.regenerateDoc(request).getBody();

        assertThat(res).isNotNull();
        assertThat(res.getDocumentId()).isEqualTo(99L);
        assertThat(res.getVersionId()).isEqualTo(401L);
        assertThat(res.getVersionNumber()).isEqualTo(1);
        assertThat(res.getStatus()).isEqualTo("DRAFT");
        assertThat(res.getPreviousHash()).isEqualTo(HashUtils.GENESIS_HASH);
        assertThat(res.getFullMarkdown()).contains("# Tài liệu Kỹ thuật: StockValidator");
    }
}
