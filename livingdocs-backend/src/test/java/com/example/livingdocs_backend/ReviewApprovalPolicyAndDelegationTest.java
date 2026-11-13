package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.application.service.ReviewServiceImpl;
import com.example.livingdocs_backend.application.service.TemplateStructureCheck;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataReviewCommentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewApprovalPolicyAndDelegationTest {

    @Mock
    private DocumentRepositoryPort documentRepositoryPort;
    @Mock
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;
    @Mock
    private ReviewRepositoryPort reviewRepositoryPort;
    @Mock
    private SpringDataRepositoryRepository repositoryRepository;
    @Mock
    private AuditServicePort auditServicePort;
    @Mock
    private TemplateStructureCheck templateStructureCheck;
    @Mock
    private DocumentServicePort documentServicePort;
    @Mock
    private SpringDataReviewCommentRepository reviewCommentRepository;
    @Mock
    private PrMergeBlockingServicePort prMergeBlockingService;
    @Mock
    private SpringDataAdminSettingRepository adminSettingRepository;
    @Mock
    private DocTemplateRepository docTemplateRepository;

    private ObjectMapper objectMapper;
    private ReviewServiceImpl reviewService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        reviewService = new ReviewServiceImpl(
                documentRepositoryPort,
                documentVersionRepositoryPort,
                reviewRepositoryPort,
                repositoryRepository,
                auditServicePort,
                templateStructureCheck,
                documentServicePort,
                reviewCommentRepository,
                prMergeBlockingService,
                adminSettingRepository,
                docTemplateRepository,
                objectMapper
        );
    }

    @Test
    @DisplayName("LD-W6-09: Tài liệu thuộc chính sách 1 cấp (API) khi được Staff duyệt sẽ chuyển thẳng sang PUBLISHED")
    void testStaffApproval_oneTier_transitionsDirectlyToPublished() throws Exception {
        Long docId = 100L;
        Document doc = Document.builder()
                .docId(docId)
                .title("API Specification Payment")
                .targetPath("docs/api/payment.md")
                .status(DocumentStatus.UNDER_REVIEW_STAFF)
                .currentVersion(1)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
        when(reviewRepositoryPort.save(any())).thenAnswer(i -> i.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(
                DocumentVersion.builder().versionId(1L).docId(docId).versionNum(1).build()
        ));

        // Thiết lập cấu hình 1 cấp cho API doc_type
        List<ApprovalPolicyDto> policies = List.of(
                ApprovalPolicyDto.builder().docType("API").tiers(1).description("1 Tier").build()
        );
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_APPROVAL_POLICIES)).thenReturn(
                Optional.of(AdminSettingEntity.builder()
                        .settingKey(ReviewServiceImpl.KEY_APPROVAL_POLICIES)
                        .settingValue(objectMapper.writeValueAsString(policies))
                        .build())
        );

        StaffActionRequest request = StaffActionRequest.builder()
                .action("APPROVE")
                .comment("Staff đã kiểm tra mã nguồn hợp lệ")
                .build();

        ReviewActionResponse response = reviewService.handleStaffAction(docId, request, 20L, "STAFF", "staff@livingdocs.internal");

        assertNotNull(response);
        assertEquals(DocumentStatus.PUBLISHED, response.getStatus());
        assertEquals("Staff đã duyệt tài liệu \"API Specification Payment\" thành công và xuất bản trực tiếp theo chính sách phê duyệt 1 cấp (PUBLISHED).", response.getMessage());

        verify(auditServicePort).recordDocumentApproval(20L, docId);
        verify(prMergeBlockingService).notifyDocumentApproved(docId);
    }

    @Test
    @DisplayName("LD-W6-09: Tài liệu thuộc chính sách 2 cấp (ARCHITECTURE) khi được Staff duyệt sẽ chuyển sang UNDER_REVIEW_MANAGER")
    void testStaffApproval_twoTier_transitionsToUnderReviewManager() throws Exception {
        Long docId = 200L;
        Document doc = Document.builder()
                .docId(docId)
                .title("System Architecture Overview")
                .targetPath("docs/architecture/system.md")
                .status(DocumentStatus.UNDER_REVIEW_STAFF)
                .currentVersion(1)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
        when(reviewRepositoryPort.save(any())).thenAnswer(i -> i.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(
                DocumentVersion.builder().versionId(2L).docId(docId).versionNum(1).build()
        ));

        // Cấu hình 2 cấp cho ARCHITECTURE
        List<ApprovalPolicyDto> policies = List.of(
                ApprovalPolicyDto.builder().docType("ARCHITECTURE").tiers(2).description("2 Tiers").build()
        );
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_APPROVAL_POLICIES)).thenReturn(
                Optional.of(AdminSettingEntity.builder()
                        .settingKey(ReviewServiceImpl.KEY_APPROVAL_POLICIES)
                        .settingValue(objectMapper.writeValueAsString(policies))
                        .build())
        );

        StaffActionRequest request = StaffActionRequest.builder()
                .action("APPROVE")
                .comment("Staff chuyển Manager duyệt cấp 2")
                .build();

        ReviewActionResponse response = reviewService.handleStaffAction(docId, request, 20L, "STAFF", "staff@livingdocs.internal");

        assertNotNull(response);
        assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, response.getStatus());
        assertTrue(response.getMessage().contains("UNDER_REVIEW_MANAGER"));
        verify(prMergeBlockingService, never()).notifyDocumentApproved(docId);
    }

    @Test
    @DisplayName("LD-W6-10: Quản lý B phê duyệt thay cho Quản lý A theo ủy quyền được ghi nhận chính xác trong audit log")
    void testManagerApproval_withActiveDelegation_recordsAuditLog() throws Exception {
        Long docId = 300L;
        Document doc = Document.builder()
                .docId(docId)
                .title("Deployment Guide")
                .status(DocumentStatus.UNDER_REVIEW_MANAGER)
                .currentVersion(1)
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
        when(reviewRepositoryPort.save(any())).thenAnswer(i -> i.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(
                DocumentVersion.builder().versionId(3L).docId(docId).versionNum(1).build()
        ));

        // Cấu hình ủy quyền: Quản lý A ủy quyền cho Quản lý B
        LocalDate today = LocalDate.now();
        List<ManagerDelegationDto> delegations = List.of(
                ManagerDelegationDto.builder()
                        .id("del-101")
                        .delegatorName("Quản lý A")
                        .delegatorEmail("managerA@livingdocs.internal")
                        .delegateeName("Quản lý B")
                        .delegateeEmail("managerB@livingdocs.internal")
                        .fromDate(today.minusDays(2).toString())
                        .toDate(today.plusDays(5).toString())
                        .active(true)
                        .reason("Công tác nước ngoài")
                        .build()
        );
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_MANAGER_DELEGATIONS)).thenReturn(
                Optional.of(AdminSettingEntity.builder()
                        .settingKey(ReviewServiceImpl.KEY_MANAGER_DELEGATIONS)
                        .settingValue(objectMapper.writeValueAsString(delegations))
                        .build())
        );

        ManagerActionRequest request = ManagerActionRequest.builder()
                .action("PUBLISH")
                .comment("Đồng ý xuất bản tài liệu")
                .build();

        ReviewActionResponse response = reviewService.handleManagerAction(
                docId, request, 32L, "MANAGER", "managerB@livingdocs.internal"
        );

        assertNotNull(response);
        assertEquals(DocumentStatus.PUBLISHED, response.getStatus());

        // Kiểm tra Audit Log có đúng chuỗi yêu cầu: 'Quản lý B phê duyệt thay cho Quản lý A theo ủy quyền'
        ArgumentCaptor<String> detailCaptor = ArgumentCaptor.forClass(String.class);
        verify(auditServicePort).recordDocumentAction(eq(32L), eq(docId), eq(AuditAction.DOCUMENT_APPROVED), detailCaptor.capture());

        String capturedDetail = detailCaptor.getValue();
        assertEquals("Quản lý B phê duyệt thay cho Quản lý A theo ủy quyền", capturedDetail);
        assertTrue(response.getMessage().contains("Quản lý B phê duyệt thay cho Quản lý A theo ủy quyền"));
    }

    @Test
    @DisplayName("Cấu hình chính sách phê duyệt GET và PUT")
    void testGetAndUpdateApprovalPolicies() throws Exception {
        // GET khi chưa có dữ liệu sẽ trả về default policies
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_APPROVAL_POLICIES)).thenReturn(Optional.empty());
        List<ApprovalPolicyDto> defaultPolicies = reviewService.getApprovalPolicies();
        assertNotNull(defaultPolicies);
        assertFalse(defaultPolicies.isEmpty());

        // PUT cập nhật
        List<ApprovalPolicyDto> newPolicies = List.of(
                ApprovalPolicyDto.builder().docType("USER_GUIDE").tiers(1).description("Staff only").build()
        );
        List<ApprovalPolicyDto> saved = reviewService.updateApprovalPolicies(newPolicies, 1L, "admin@test.com");
        assertEquals(1, saved.size());
        assertEquals("USER_GUIDE", saved.get(0).getDocType());
        verify(adminSettingRepository).save(any(AdminSettingEntity.class));
    }

    @Test
    @DisplayName("Cấu hình ủy quyền Manager GET và CREATE")
    void testGetAndCreateManagerDelegation() {
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_MANAGER_DELEGATIONS)).thenReturn(Optional.empty());
        List<ManagerDelegationDto> list = reviewService.getManagerDelegations();
        assertTrue(list.isEmpty());

        ManagerDelegationDto newDel = ManagerDelegationDto.builder()
                .delegatorName("Quản lý A")
                .delegatorEmail("a@manager.com")
                .delegateeName("Quản lý B")
                .delegateeEmail("b@manager.com")
                .fromDate("2026-11-01")
                .toDate("2026-11-30")
                .build();

        ManagerDelegationDto created = reviewService.createManagerDelegation(newDel, 1L, "a@manager.com");
        assertNotNull(created.getId());
        assertEquals("Quản lý A", created.getDelegatorName());
        assertEquals("Quản lý B", created.getDelegateeName());
        verify(adminSettingRepository).save(any(AdminSettingEntity.class));
    }
}
