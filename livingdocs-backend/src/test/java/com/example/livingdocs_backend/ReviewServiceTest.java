package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ManagerActionRequest;
import com.example.livingdocs_backend.application.dto.ReviewActionResponse;
import com.example.livingdocs_backend.application.dto.ReviewQueueItemResponse;
import com.example.livingdocs_backend.application.dto.StaffActionRequest;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.ReviewServiceImpl;
import com.example.livingdocs_backend.domain.exception.DocumentNotFoundException;
import com.example.livingdocs_backend.domain.exception.UnauthorizedDocumentReviewException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.model.Review;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử Use Case Service - Hàng đợi và Thao tác Rà soát Staff & Manager (/api/reviews)")
class ReviewServiceTest {

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

    @InjectMocks
    private ReviewServiceImpl reviewService;

    private Document sampleStaffDoc;
    private Document sampleManagerDoc;
    private DocumentVersion sampleVersion1;
    private RepositoryEntity sampleRepo;

    @BeforeEach
    void setUp() {
        sampleRepo = RepositoryEntity.builder()
                .repositoryId(1L)
                .repoName("livingdocs-backend")
                .repoFullName("LeNgocChau9/livingdocs-backend")
                .defaultBranch("main")
                .build();

        sampleStaffDoc = Document.builder()
                .docId(10L)
                .repoId(1L)
                .title("Tài liệu Hướng dẫn Clean Architecture")
                .targetPath("docs/clean-arch.md")
                .status(DocumentStatus.UNDER_REVIEW_STAFF)
                .currentVersion(1)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        sampleManagerDoc = Document.builder()
                .docId(20L)
                .repoId(1L)
                .title("Tài liệu Microservices Design")
                .targetPath("docs/microservices.md")
                .status(DocumentStatus.UNDER_REVIEW_MANAGER)
                .currentVersion(1)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        sampleVersion1 = DocumentVersion.builder()
                .versionId(101L)
                .docId(10L)
                .versionNum(1)
                .content("# Nội dung tài liệu kỹ thuật")
                .actorRole(ActorRole.DEV)
                .triggerType("MANUAL_CREATE")
                .hash("hash123")
                .prevHash("0000000000000000000000000000000000000000000000000000000000000000")
                .createdAt(Instant.now())
                .build();
    }

    @Nested
    @DisplayName("1. Kiểm thử GET /api/reviews/staff/queue (Hàng đợi Staff)")
    class StaffQueueTests {

        @Test
        @DisplayName("Lấy danh sách tài liệu chờ Staff rà soát kèm thông tin Repo và Tác giả")
        void shouldReturnStaffQueueWithRepoAndAuthor() {
            when(documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_STAFF))
                    .thenReturn(List.of(sampleStaffDoc));
            when(repositoryRepository.findById(1L)).thenReturn(Optional.of(sampleRepo));
            when(documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(10L))
                    .thenReturn(List.of(sampleVersion1));

            List<ReviewQueueItemResponse> queue = reviewService.getStaffQueue();

            assertNotNull(queue);
            assertEquals(1, queue.size());
            ReviewQueueItemResponse item = queue.get(0);

            assertEquals(10L, item.getId());
            assertEquals(10L, item.getDocId());
            assertEquals("Tài liệu Hướng dẫn Clean Architecture", item.getTitle());
            assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, item.getStatus());

            // Kiểm tra thông tin Repo
            assertEquals(1L, item.getRepoId());
            assertEquals("livingdocs-backend", item.getRepoName());
            assertEquals("LeNgocChau9/livingdocs-backend", item.getRepoFullName());
            assertNotNull(item.getRepo());
            assertEquals("main", item.getRepo().getDefaultBranch());

            // Kiểm tra thông tin Tác giả
            assertNotNull(item.getAuthor());
            assertEquals("DEVELOPER", item.getAuthorRole());
            assertEquals("developer@livingdocs.internal", item.getAuthorEmail());

            // Kiểm tra nội dung trích xuất
            assertEquals("# Nội dung tài liệu kỹ thuật", item.getLatestContent());
        }
    }

    @Nested
    @DisplayName("2. Kiểm thử POST /api/reviews/{id}/staff-action (Thao tác Staff)")
    class StaffActionTests {

        @Test
        @DisplayName("Staff duyệt cấp 1 thành công -> Chuyển sang UNDER_REVIEW_MANAGER và lưu Review")
        void shouldApproveStaffActionSuccessfully() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleStaffDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion1));
            when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> {
                Review r = i.getArgument(0);
                r.setReviewId(501L);
                return r;
            });

            StaffActionRequest request = StaffActionRequest.builder()
                    .action("APPROVE")
                    .comment("Đã đối chiếu AST code_entities, cấu trúc tài liệu đạt yêu cầu.")
                    .build();

            ReviewActionResponse response = reviewService.handleStaffAction(
                    10L, request, 201L, "STAFF", "staff@livingdocs.internal");

            assertNotNull(response);
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, response.getStatus());
            assertEquals(501L, response.getReviewId());
            assertEquals("APPROVE", response.getAction());
            assertEquals("staff@livingdocs.internal", response.getReviewer());
            assertTrue(response.getMessage().contains("UNDER_REVIEW_MANAGER"));

            verify(documentRepositoryPort).save(argThat(d -> d.getStatus() == DocumentStatus.UNDER_REVIEW_MANAGER));
            verify(reviewRepositoryPort).save(argThat(r ->
                    r.getDocId().equals(10L) &&
                    "APPROVED".equals(r.getResult()) &&
                    r.getGeneralComment().contains("AST")));
        }

        @Test
        @DisplayName("Staff từ chối cấp 1 -> Chuyển sang REJECTED kèm lý do")
        void shouldRejectStaffActionSuccessfully() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleStaffDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion1));
            when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> {
                Review r = i.getArgument(0);
                r.setReviewId(502L);
                return r;
            });

            StaffActionRequest request = StaffActionRequest.builder()
                    .action("REJECT")
                    .comment("Sai lệch sơ đồ luồng so với code thực tế, yêu cầu sửa lại.")
                    .build();

            ReviewActionResponse response = reviewService.handleStaffAction(
                    10L, request, 201L, "STAFF", "staff@livingdocs.internal");

            assertNotNull(response);
            assertEquals(DocumentStatus.REJECTED, response.getStatus());
            assertEquals(502L, response.getReviewId());
            assertEquals("REJECT", response.getAction());

            verify(documentRepositoryPort).save(argThat(d -> d.getStatus() == DocumentStatus.REJECTED));
            verify(reviewRepositoryPort).save(argThat(r -> "REJECTED".equals(r.getResult())));
        }

        @Test
        @DisplayName("Chặn Developer thực hiện duyệt cấp 1 -> Ném UnauthorizedDocumentReviewException")
        void shouldBlockDeveloperFromStaffAction() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleStaffDoc));

            StaffActionRequest request = StaffActionRequest.builder()
                    .action("APPROVE")
                    .build();

            assertThrows(UnauthorizedDocumentReviewException.class, () ->
                    reviewService.handleStaffAction(10L, request, 101L, "DEVELOPER", "dev@livingdocs.internal"));

            verify(documentRepositoryPort, never()).save(any());
            verify(reviewRepositoryPort, never()).save(any());
        }
    }

    @Nested
    @DisplayName("3. Kiểm thử GET /api/reviews/manager/queue (Hàng đợi Manager)")
    class ManagerQueueTests {

        @Test
        @DisplayName("Lấy danh sách tài liệu chờ Manager duyệt kèm ghi chú từ Staff")
        void shouldReturnManagerQueueWithStaffComment() {
            when(documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_MANAGER))
                    .thenReturn(List.of(sampleManagerDoc));
            when(repositoryRepository.findById(1L)).thenReturn(Optional.of(sampleRepo));
            when(documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(20L))
                    .thenReturn(List.of(sampleVersion1));

            Review previousStaffReview = Review.builder()
                    .reviewId(301L)
                    .docId(20L)
                    .reviewer("staff@livingdocs.internal")
                    .generalComment("Staff đã kiểm thử và đề xuất duyệt.")
                    .result("APPROVED")
                    .createdAt(Instant.now())
                    .build();
            when(reviewRepositoryPort.findLatestByDocId(20L)).thenReturn(Optional.of(previousStaffReview));

            List<ReviewQueueItemResponse> queue = reviewService.getManagerQueue();

            assertNotNull(queue);
            assertEquals(1, queue.size());
            ReviewQueueItemResponse item = queue.get(0);

            assertEquals(20L, item.getId());
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, item.getStatus());
            assertEquals("Staff đã kiểm thử và đề xuất duyệt.", item.getStaffComment());
            assertEquals("staff@livingdocs.internal", item.getStaffReviewer());
            assertNotNull(item.getStaffReviewedAt());
        }
    }

    @Nested
    @DisplayName("4. Kiểm thử POST /api/reviews/{id}/manager-action (Thao tác Manager)")
    class ManagerActionTests {

        @Test
        @DisplayName("Manager phê duyệt xuất bản -> Chuyển sang PUBLISHED, ghi Audit Log và lưu Review")
        void shouldPublishManagerActionSuccessfully() {
            when(documentRepositoryPort.findById(20L)).thenReturn(Optional.of(sampleManagerDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(20L)).thenReturn(Optional.of(sampleVersion1));
            when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> {
                Review r = i.getArgument(0);
                r.setReviewId(601L);
                return r;
            });

            ManagerActionRequest request = ManagerActionRequest.builder()
                    .action("PUBLISH")
                    .comment("Đồng ý phê duyệt xuất bản chính thức lên wiki.")
                    .build();

            ReviewActionResponse response = reviewService.handleManagerAction(
                    20L, request, 301L, "MANAGER", "manager@livingdocs.internal");

            assertNotNull(response);
            assertEquals(DocumentStatus.PUBLISHED, response.getStatus());
            assertEquals(601L, response.getReviewId());
            assertTrue(response.getMessage().contains("PUBLISHED"));

            verify(documentRepositoryPort).save(argThat(d -> d.getStatus() == DocumentStatus.PUBLISHED));
            verify(auditServicePort).recordDocumentApproval(301L, 20L);
            verify(reviewRepositoryPort).save(argThat(r ->
                    r.getDocId().equals(20L) &&
                    "PUBLISHED".equals(r.getResult())));
        }

        @Test
        @DisplayName("Manager trả về (RETURN / REJECT) -> Chuyển sang REJECTED kèm nhận xét")
        void shouldRejectManagerActionSuccessfully() {
            when(documentRepositoryPort.findById(20L)).thenReturn(Optional.of(sampleManagerDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(i -> i.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(20L)).thenReturn(Optional.of(sampleVersion1));
            when(reviewRepositoryPort.save(any(Review.class))).thenAnswer(i -> {
                Review r = i.getArgument(0);
                r.setReviewId(602L);
                return r;
            });

            ManagerActionRequest request = ManagerActionRequest.builder()
                    .action("RETURN")
                    .comment("Cần bổ sung phần bảo mật API trước khi phát hành.")
                    .build();

            ReviewActionResponse response = reviewService.handleManagerAction(
                    20L, request, 301L, "MANAGER", "manager@livingdocs.internal");

            assertNotNull(response);
            assertEquals(DocumentStatus.REJECTED, response.getStatus());

            verify(documentRepositoryPort).save(argThat(d -> d.getStatus() == DocumentStatus.REJECTED));
            verify(reviewRepositoryPort).save(argThat(r -> "REJECTED".equals(r.getResult())));
            verify(auditServicePort, never()).recordDocumentApproval(any(), any());
        }

        @Test
        @DisplayName("Chặn Staff thực hiện duyệt cấp 2 của Manager -> Ném UnauthorizedDocumentReviewException")
        void shouldBlockStaffFromManagerAction() {
            when(documentRepositoryPort.findById(20L)).thenReturn(Optional.of(sampleManagerDoc));

            ManagerActionRequest request = ManagerActionRequest.builder()
                    .action("PUBLISH")
                    .build();

            assertThrows(UnauthorizedDocumentReviewException.class, () ->
                    reviewService.handleManagerAction(20L, request, 201L, "STAFF", "staff@livingdocs.internal"));

            verify(documentRepositoryPort, never()).save(any());
            verify(reviewRepositoryPort, never()).save(any());
        }

        @Test
        @DisplayName("Tài liệu không tồn tại -> Ném DocumentNotFoundException")
        void shouldThrowNotFoundWhenDocDoesNotExist() {
            when(documentRepositoryPort.findById(999L)).thenReturn(Optional.empty());
            when(reviewRepositoryPort.findById(999L)).thenReturn(Optional.empty());

            ManagerActionRequest request = ManagerActionRequest.builder()
                    .action("PUBLISH")
                    .build();

            assertThrows(DocumentNotFoundException.class, () ->
                    reviewService.handleManagerAction(999L, request, 301L, "MANAGER", "manager@livingdocs.internal"));
        }
    }
}
