package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.application.service.ReviewServiceImpl;
import com.example.livingdocs_backend.application.service.TemplateStructureCheck;
import com.example.livingdocs_backend.domain.model.*;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.bootstrap.ApprovalConfigMigrationRunner;
import com.example.livingdocs_backend.infrastructure.config.DatabaseSchemaBootstrap;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalDelegationEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalPolicyEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewCommentEntity;
import org.springframework.core.annotation.Order;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataManagerApprovalDelegationRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataManagerApprovalPolicyRepository;
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
import java.util.Set;

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
    @Mock
    private ChangelogServicePort changelogServicePort;
    @Mock
    private SpringDataManagerApprovalPolicyRepository managerApprovalPolicyRepository;
    @Mock
    private SpringDataManagerApprovalDelegationRepository managerApprovalDelegationRepository;
    @Mock
    private UserRepositoryPort userRepositoryPort;

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
                objectMapper,
                changelogServicePort,
                managerApprovalPolicyRepository,
                managerApprovalDelegationRepository,
                userRepositoryPort
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
        when(managerApprovalPolicyRepository.save(any())).thenAnswer(i -> i.getArgument(0));
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
        when(managerApprovalDelegationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
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

    @Test
    @DisplayName("LD-W6-09: Staff duyệt tài liệu ghi nhận Changelog chính xác")
    void testStaffApproval_recordsChangelogEntry() throws Exception {
        Long docId = 400L;
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
                DocumentVersion.builder().versionId(4L).docId(docId).versionNum(1).build()
        ));

        StaffActionRequest request = StaffActionRequest.builder()
                .action("APPROVE")
                .comment("Staff duyệt API")
                .build();

        ReviewActionResponse response = reviewService.handleStaffAction(docId, request, 20L, "STAFF", "staff@livingdocs.internal");
        assertNotNull(response);

        // Verify Changelog được ghi nhận
        ArgumentCaptor<String> summaryCaptor = ArgumentCaptor.forClass(String.class);
        verify(changelogServicePort).logChange(eq(docId), eq(4L), eq(20L), eq("STAFF"), summaryCaptor.capture());
        assertTrue(summaryCaptor.getValue().contains("Staff đã phê duyệt"));
    }

    @Test
    @DisplayName("LD-W6-05: Review history map chính xác CHANGES_REQUESTED thành returned và PENDING thành pending")
    void testGetReviewHistory_mapsReturnedAndPendingCorrectly() {
        Review r1 = Review.builder()
                .reviewId(1L)
                .docId(10L)
                .reviewer("staff@livingdocs.internal")
                .result("CHANGES_REQUESTED")
                .generalComment("Cần bổ sung ví dụ")
                .createdAt(Instant.now())
                .build();

        Review r2 = Review.builder()
                .reviewId(2L)
                .docId(11L)
                .reviewer("staff@livingdocs.internal")
                .result("PENDING")
                .generalComment("Đang chờ phản hồi")
                .createdAt(Instant.now())
                .build();

        Review r3 = Review.builder()
                .reviewId(3L)
                .docId(12L)
                .reviewer("staff@livingdocs.internal")
                .result("APPROVED")
                .generalComment("Đã duyệt tốt")
                .createdAt(Instant.now())
                .build();

        when(reviewRepositoryPort.findAll()).thenReturn(List.of(r1, r2, r3));
        when(documentRepositoryPort.findById(anyLong())).thenReturn(Optional.empty());

        List<ReviewHistoryItemResponse> history = reviewService.getReviewHistory();
        assertEquals(3, history.size());

        assertEquals("returned", history.get(0).getAction());
        assertEquals("CHANGES_REQUESTED", history.get(0).getResult());

        assertEquals("pending", history.get(1).getAction());
        assertEquals("PENDING", history.get(1).getResult());

        assertEquals("approved", history.get(2).getAction());
        assertEquals("APPROVED", history.get(2).getResult());
    }

    @Test
    @DisplayName("LD-W6-04: Review Comments CRUD - tạo nhận xét, lấy danh sách và giải quyết (Resolve)")
    void testReviewComments_createGetAndResolve() {
        Long docId = 500L;
        Long commentId = 77L;

        CreateReviewCommentRequest createReq = CreateReviewCommentRequest.builder()
                .reviewId(10L)
                .textSegment("GET /api/v1/orders")
                .detailedComment("Cần mô tả mã lỗi 404")
                .authorRole("STAFF")
                .authorEmail("staff@livingdocs.internal")
                .build();

        ReviewCommentEntity createdEntity = ReviewCommentEntity.builder()
                .commentId(commentId)
                .docId(docId)
                .reviewId(10L)
                .textSegment("GET /api/v1/orders")
                .detailedComment("Cần mô tả mã lỗi 404")
                .status("OPEN")
                .authorRole("STAFF")
                .authorEmail("staff@livingdocs.internal")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(reviewCommentRepository.save(any(ReviewCommentEntity.class))).thenReturn(createdEntity);

        // 1. Tạo nhận xét
        ReviewCommentDto commentDto = reviewService.addDocumentComment(
                docId, createReq, 20L, "STAFF", "staff@livingdocs.internal"
        );
        assertNotNull(commentDto);
        assertEquals(commentId, commentDto.getCommentId());
        assertEquals("OPEN", commentDto.getStatus());
        assertEquals("GET /api/v1/orders", commentDto.getTextSegment());
        assertEquals("Cần mô tả mã lỗi 404", commentDto.getDetailedComment());

        // 2. Lấy danh sách nhận xét
        when(reviewCommentRepository.findByDocIdOrderByCreatedAtAsc(docId)).thenReturn(List.of(createdEntity));
        List<ReviewCommentDto> list = reviewService.getDocumentComments(docId, "ALL");
        assertEquals(1, list.size());
        assertEquals("OPEN", list.get(0).getStatus());

        // 3. Giải quyết nhận xét (Resolve)
        when(reviewCommentRepository.findById(commentId)).thenReturn(Optional.of(createdEntity));
        UpdateReviewCommentRequest resolveReq = UpdateReviewCommentRequest.builder()
                .status("RESOLVED")
                .build();

        ReviewCommentDto resolvedDto = reviewService.updateCommentStatus(
                docId, commentId, resolveReq, 15L, "DEVELOPER", "dev@livingdocs.internal"
        );
        assertNotNull(resolvedDto);
        assertEquals("RESOLVED", resolvedDto.getStatus());
        assertNotNull(resolvedDto.getUpdatedAt());
        verify(reviewCommentRepository, atLeast(2)).save(any(ReviewCommentEntity.class));
    }

    @Test
    @DisplayName("LD-W6-07: Lấy danh sách Workspace Managers trả về các tài khoản có vai trò MANAGER hoặc ADMIN")
    void testGetWorkspaceManagers_returnsManagersAndAdmins() {
        User u1 = User.builder()
                .userId(1L)
                .fullName("Quản lý Nguyễn")
                .email("manager.nguyen@livingdocs.internal")
                .roles(Set.of(RoleType.ROLE_MANAGER))
                .status("ACTIVE")
                .build();

        User u2 = User.builder()
                .userId(2L)
                .fullName("Quản trị Trần")
                .email("admin.tran@livingdocs.internal")
                .roles(Set.of(RoleType.ROLE_ADMIN))
                .status("ACTIVE")
                .build();

        User u3 = User.builder()
                .userId(3L)
                .fullName("Lập trình viên Lê")
                .email("dev.le@livingdocs.internal")
                .roles(Set.of(RoleType.ROLE_DEVELOPER))
                .status("ACTIVE")
                .build();

        when(userRepositoryPort.findAll()).thenReturn(List.of(u1, u2, u3));

        List<WorkspaceManagerResponse> managers = reviewService.getWorkspaceManagers();
        assertNotNull(managers);
        assertEquals(2, managers.size());
        assertTrue(managers.stream().anyMatch(m -> m.getEmail().equals("manager.nguyen@livingdocs.internal")));
        assertTrue(managers.stream().anyMatch(m -> m.getEmail().equals("admin.tran@livingdocs.internal")));
        assertFalse(managers.stream().anyMatch(m -> m.getEmail().equals("dev.le@livingdocs.internal")));
    }

    @Test
    @DisplayName("Iter2-1 & 2: DatabaseSchemaBootstrap chạy trước ApprovalConfigMigrationRunner và migration chống trùng docType")
    void testMigrationOrderingAndPolicyDeduplication() throws Exception {
        Order schemaOrder = DatabaseSchemaBootstrap.class.getAnnotation(Order.class);
        Order migrationOrder = ApprovalConfigMigrationRunner.class.getAnnotation(Order.class);
        assertNotNull(schemaOrder);
        assertNotNull(migrationOrder);
        assertTrue(schemaOrder.value() < migrationOrder.value());

        List<ApprovalPolicyDto> legacyBlob = List.of(
                ApprovalPolicyDto.builder().docType("API").tiers(1).description("Legacy API").build(),
                ApprovalPolicyDto.builder().docType("USER_GUIDE").tiers(1).description("Legacy User Guide").build(),
                ApprovalPolicyDto.builder().docType("RELEASE_NOTE").tiers(1).description("Legacy Release Note").build()
        );
        when(managerApprovalPolicyRepository.findByWorkspaceId(1L)).thenReturn(List.of());
        when(adminSettingRepository.findById(ApprovalConfigMigrationRunner.KEY_APPROVAL_POLICIES)).thenReturn(
                Optional.of(AdminSettingEntity.builder()
                        .settingKey(ApprovalConfigMigrationRunner.KEY_APPROVAL_POLICIES)
                        .settingValue(objectMapper.writeValueAsString(legacyBlob))
                        .build())
        );
        when(managerApprovalPolicyRepository.findByWorkspaceIdAndDocumentType(eq(1L), anyString()))
                .thenReturn(Optional.empty());
        when(managerApprovalPolicyRepository.save(any(ManagerApprovalPolicyEntity.class)))
                .thenAnswer(i -> i.getArgument(0));

        ApprovalConfigMigrationRunner runner = new ApprovalConfigMigrationRunner(
                managerApprovalPolicyRepository,
                managerApprovalDelegationRepository,
                adminSettingRepository,
                objectMapper
        );
        runner.migrateApprovalPolicies();

        ArgumentCaptor<ManagerApprovalPolicyEntity> savedCaptor = ArgumentCaptor.forClass(ManagerApprovalPolicyEntity.class);
        verify(managerApprovalPolicyRepository, times(6)).save(savedCaptor.capture());

        List<String> savedTypes = savedCaptor.getAllValues().stream()
                .map(ManagerApprovalPolicyEntity::getDocumentType)
                .toList();
        assertEquals(1, savedTypes.stream().filter("MODULE_GUIDE"::equals).count());
        assertTrue(savedTypes.containsAll(List.of(
                "API_REFERENCE", "PROJECT_README", "MODULE_GUIDE",
                "ARCHITECTURE_ADR", "PROJECT_DOCUMENTATION", "DEFAULT"
        )));
    }

    @Test
    @DisplayName("Iter2-3: Manager trả lại Staff ghi đầy đủ lý do vào Audit Log và Changelog")
    void testManagerReturnStaff_includesReasonInAuditAndChangelog() {
        Long docId = 601L;
        Document doc = Document.builder()
                .docId(docId)
                .title("Auth Flow Doc")
                .status(DocumentStatus.UNDER_REVIEW_MANAGER)
                .currentVersion(2)
                .build();
        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
        when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> i.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(
                DocumentVersion.builder().versionId(60L).docId(docId).versionNum(2).build()
        ));

        ManagerActionRequest req = ManagerActionRequest.builder()
                .action("RETURN_STAFF")
                .comment("Thiếu ví dụ mã lỗi 401")
                .build();
        ReviewActionResponse res = reviewService.handleManagerAction(docId, req, 30L, "MANAGER", "mgr@livingdocs.internal");
        assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, res.getStatus());

        ArgumentCaptor<String> auditCaptor = ArgumentCaptor.forClass(String.class);
        verify(auditServicePort).recordDocumentAction(eq(30L), eq(docId), eq(AuditAction.DOCUMENT_RETURNED_STAFF), auditCaptor.capture());
        assertTrue(auditCaptor.getValue().contains("Lý do: Thiếu ví dụ mã lỗi 401"));

        ArgumentCaptor<String> changelogCaptor = ArgumentCaptor.forClass(String.class);
        verify(changelogServicePort).logChange(eq(docId), eq(60L), eq(30L), eq("MANAGER"), changelogCaptor.capture());
        assertTrue(changelogCaptor.getValue().contains("Lý do: Thiếu ví dụ mã lỗi 401"));
    }

    @Test
    @DisplayName("Iter2-4: Staff duyệt đóng bản ghi PENDING do AutoDraft tạo thay vì chèn trùng dòng mới")
    void testStaffAction_updatesExistingPendingAutoDraftReview() {
        Long docId = 701L;
        Document doc = Document.builder()
                .docId(docId)
                .title("API Reference")
                .targetPath("docs/api/orders.md")
                .status(DocumentStatus.UNDER_REVIEW_STAFF)
                .currentVersion(3)
                .build();
        Review pendingAutoDraft = Review.builder()
                .reviewId(99L)
                .docId(docId)
                .versionId(70L)
                .reviewer("AI_AGENT")
                .result("PENDING")
                .generalComment("AutoDraft pending")
                .createdAt(Instant.now().minusSeconds(60))
                .build();

        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(
                DocumentVersion.builder().versionId(71L).docId(docId).versionNum(3).build()
        ));
        when(reviewRepositoryPort.findFirstByDocIdAndResultOrderByCreatedAtDesc(docId, "PENDING"))
                .thenReturn(Optional.of(pendingAutoDraft));
        when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> i.getArgument(0));

        StaffActionRequest req = StaffActionRequest.builder()
                .action("APPROVE")
                .comment("Staff đã xác minh")
                .build();
        ReviewActionResponse res = reviewService.handleStaffAction(docId, req, 21L, "STAFF", "staff2@livingdocs.internal");

        assertEquals(99L, res.getReviewId());
        ArgumentCaptor<Review> reviewCaptor = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepositoryPort).save(reviewCaptor.capture());
        assertEquals(99L, reviewCaptor.getValue().getReviewId());
        assertEquals("APPROVED", reviewCaptor.getValue().getResult());
        assertEquals("staff2@livingdocs.internal", reviewCaptor.getValue().getReviewer());
    }

    @Test
    @DisplayName("Iter2-5 & 6: Giải quyết ID ủy quyền qua email, không gán nhầm user 1L, cho phép toDate rỗng, fail-closed ngày lỗi và chống trùng dual-write")
    void testDelegationResolutionAndFailClosedDateRange() throws Exception {
        User delegator = User.builder().userId(10L).fullName("Nguyễn Quản Lý").email("mgr.a@livingdocs.internal").build();
        User delegatee = User.builder().userId(25L).fullName("Trần Phó Phòng").email("mgr.b@livingdocs.internal").build();
        when(userRepositoryPort.findByEmail("mgr.a@livingdocs.internal")).thenReturn(Optional.of(delegator));
        when(userRepositoryPort.findByEmail("mgr.b@livingdocs.internal")).thenReturn(Optional.of(delegatee));
        when(managerApprovalDelegationRepository.save(any(ManagerApprovalDelegationEntity.class)))
                .thenAnswer(i -> {
                    ManagerApprovalDelegationEntity e = i.getArgument(0);
                    e.setDelegationId(55L);
                    return e;
                });
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_MANAGER_DELEGATIONS)).thenReturn(Optional.empty());
        when(adminSettingRepository.save(any(AdminSettingEntity.class))).thenAnswer(i -> i.getArgument(0));

        ManagerDelegationDto req = ManagerDelegationDto.builder()
                .delegatorEmail("mgr.a@livingdocs.internal")
                .delegateeEmail("mgr.b@livingdocs.internal")
                .fromDate(LocalDate.now().toString())
                .toDate("")
                .reason("Nghỉ phép dài ngày")
                .build();

        ManagerDelegationDto created = reviewService.createManagerDelegation(req, 10L, "mgr.a@livingdocs.internal");
        assertEquals("55", created.getId());
        assertEquals(10L, created.getDelegatorId());
        assertEquals(25L, created.getDelegateeId());
        assertEquals("Nguyễn Quản Lý", created.getDelegatorName());
        assertEquals("Trần Phó Phòng", created.getDelegateeName());
        assertNull(created.getToDate());

        ArgumentCaptor<AdminSettingEntity> settingCaptor = ArgumentCaptor.forClass(AdminSettingEntity.class);
        verify(adminSettingRepository).save(settingCaptor.capture());
        List<ManagerDelegationDto> persistedJson = objectMapper.readValue(
                settingCaptor.getValue().getSettingValue(),
                new com.fasterxml.jackson.core.type.TypeReference<List<ManagerDelegationDto>>() {}
        );
        assertEquals(1, persistedJson.size());

        // Kiểm tra isDelegatee không gán nhầm cho user 1L khi email khác & isWithinDateRange fail-closed với ngày lỗi
        Long docId = 801L;
        Document doc = Document.builder()
                .docId(docId)
                .title("Policy Doc")
                .status(DocumentStatus.UNDER_REVIEW_MANAGER)
                .currentVersion(1)
                .build();
        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
        when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> i.getArgument(0));
        when(documentVersionRepositoryPort.findLatestByDocId(docId)).thenReturn(Optional.of(
                DocumentVersion.builder().versionId(80L).docId(docId).versionNum(1).build()
        ));

        ManagerApprovalDelegationEntity legacyEntity = ManagerApprovalDelegationEntity.builder()
                .delegationId(77L)
                .workspaceId(1L)
                .delegatorId(10L)
                .delegateId(1L) // legacy default
                .delegatorName("Nguyễn Quản Lý")
                .delegatorEmail("mgr.a@livingdocs.internal")
                .delegateeName("Trần Phó Phòng")
                .delegateeEmail("mgr.b@livingdocs.internal")
                .active(true)
                .startsAt(Instant.now().minusSeconds(3600))
                .endsAt(Instant.now().plusSeconds(3600))
                .build();
        when(managerApprovalDelegationRepository.findByWorkspaceId(1L)).thenReturn(List.of(legacyEntity));

        ReviewActionResponse adminApproveRes = reviewService.handleManagerAction(
                docId,
                ManagerActionRequest.builder().action("PUBLISH").comment("Admin duyệt trực tiếp").build(),
                1L,
                "ADMIN",
                "admin@livingdocs.internal"
        );
        assertFalse(adminApproveRes.getMessage().contains("theo ủy quyền"));

        // Ngày lỗi -> fail-closed (không kích hoạt ủy quyền)
        when(managerApprovalDelegationRepository.findByWorkspaceId(1L)).thenReturn(List.of());
        List<ManagerDelegationDto> malformedDelegations = List.of(
                ManagerDelegationDto.builder()
                        .id("bad-date")
                        .delegatorName("Mgr A")
                        .delegateeEmail("mgr.b@livingdocs.internal")
                        .fromDate("not-a-date")
                        .toDate("2099-12-31")
                        .active(true)
                        .build()
        );
        when(adminSettingRepository.findById(ReviewServiceImpl.KEY_MANAGER_DELEGATIONS)).thenReturn(
                Optional.of(AdminSettingEntity.builder()
                        .settingKey(ReviewServiceImpl.KEY_MANAGER_DELEGATIONS)
                        .settingValue(objectMapper.writeValueAsString(malformedDelegations))
                        .build())
        );
        doc.setStatus(DocumentStatus.UNDER_REVIEW_MANAGER);
        ReviewActionResponse badDateRes = reviewService.handleManagerAction(
                docId,
                ManagerActionRequest.builder().action("PUBLISH").comment("Duyệt").build(),
                25L,
                "MANAGER",
                "mgr.b@livingdocs.internal"
        );
        assertFalse(badDateRes.getMessage().contains("theo ủy quyền"));
    }

    @Test
    @DisplayName("Iter2-7: Kiểm tra quyền sở hữu comment theo docId, validate status và ưu tiên JWT principal")
    void testCommentSecurityAndOwnershipChecks() {
        Long docId = 900L;
        Long otherDocId = 999L;
        Long commentId = 88L;

        CreateReviewCommentRequest spoofReq = CreateReviewCommentRequest.builder()
                .textSegment("Section 1")
                .detailedComment("Cần cập nhật")
                .authorEmail("spoofed@evil.internal")
                .authorRole("ADMIN")
                .build();
        when(reviewCommentRepository.save(any(ReviewCommentEntity.class)))
                .thenAnswer(i -> i.getArgument(0));

        ReviewCommentDto added = reviewService.addDocumentComment(
                docId, spoofReq, 20L, "STAFF", "real.staff@livingdocs.internal"
        );
        assertEquals("real.staff@livingdocs.internal", added.getAuthorEmail());
        assertEquals("STAFF", added.getAuthorRole());

        ReviewCommentEntity existing = ReviewCommentEntity.builder()
                .commentId(commentId)
                .docId(docId)
                .detailedComment("Cần cập nhật")
                .status("OPEN")
                .build();
        when(reviewCommentRepository.findById(commentId)).thenReturn(Optional.of(existing));

        assertThrows(IllegalArgumentException.class, () ->
                reviewService.updateCommentStatus(otherDocId, commentId,
                        UpdateReviewCommentRequest.builder().status("RESOLVED").build(),
                        20L, "STAFF", "real.staff@livingdocs.internal"));

        assertThrows(IllegalArgumentException.class, () ->
                reviewService.updateCommentStatus(docId, commentId,
                        UpdateReviewCommentRequest.builder().status("INVALID_STATUS").build(),
                        20L, "STAFF", "real.staff@livingdocs.internal"));
    }
}
