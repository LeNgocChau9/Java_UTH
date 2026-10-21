package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.livingdocs_backend.application.dto.DocumentResponse;
import com.example.livingdocs_backend.application.dto.ManagerReviewDecisionRequest;
import com.example.livingdocs_backend.application.dto.StaffReviewDecisionRequest;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.DocumentServiceImpl;
import com.example.livingdocs_backend.domain.exception.UnauthorizedDocumentReviewException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử Use Case Service - Quản lý duyệt và chuyển đổi trạng thái tài liệu")
class DocumentServiceTest {

    @Mock
    private DocumentRepositoryPort documentRepositoryPort;

    @Mock
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;

    @Mock
    private AuditServicePort auditServicePort;

    @InjectMocks
    private DocumentServiceImpl documentService;

    private Document sampleDoc;
    private DocumentVersion sampleVersion;

    @BeforeEach
    void setUp() {
        sampleDoc = Document.builder()
                .docId(10L)
                .collectionId(1L)
                .repoId(100L)
                .title("Tài liệu đặc tả kiến trúc")
                .targetPath("docs/architecture.md")
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        sampleVersion = DocumentVersion.builder()
                .versionId(1L)
                .docId(10L)
                .versionNum(1)
                .content("# Kiến trúc hệ thống\nClean Architecture...")
                .actorRole(ActorRole.DEV)
                .triggerType("INITIAL_CREATION")
                .hash("hash123")
                .prevHash("0000000000000000000000000000000000000000000000000000000000000000")
                .createdAt(Instant.now())
                .build();
    }

    @Nested
    @DisplayName("1. Gửi tài liệu để review (submitForReview)")
    class SubmitForReviewTests {

        @Test
        @DisplayName("Gửi duyệt thành công: DRAFT -> UNDER_REVIEW_STAFF")
        void shouldSubmitDraftForReviewSuccessfully() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion));

            DocumentResponse response = documentService.submitForReview(10L, 101L);

            assertNotNull(response);
            assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, response.getStatus());
            verify(documentRepositoryPort).save(argThat(doc -> doc.getStatus() == DocumentStatus.UNDER_REVIEW_STAFF));
        }
    }

    @Nested
    @DisplayName("2. Xử lý duyệt cấp 1 - Staff Review (processStaffReview)")
    class StaffReviewTests {

        @BeforeEach
        void setDocToUnderReviewStaff() {
            sampleDoc.setStatus(DocumentStatus.UNDER_REVIEW_STAFF);
        }

        @Test
        @DisplayName("Staff duyệt chấp nhận (APPROVE) -> Chuyển sang UNDER_REVIEW_MANAGER")
        void shouldAllowStaffToApproveToUnderReviewManager() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion));

            StaffReviewDecisionRequest req = StaffReviewDecisionRequest.builder()
                    .decision("APPROVE")
                    .comment("Đã kiểm tra AST và cấu trúc markdown, đạt yêu cầu.")
                    .build();

            DocumentResponse response = documentService.processStaffReview(10L, req, 201L, "STAFF");

            assertNotNull(response);
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, response.getStatus());
            verify(documentRepositoryPort).save(argThat(doc -> doc.getStatus() == DocumentStatus.UNDER_REVIEW_MANAGER));
        }

        @Test
        @DisplayName("Staff từ chối (REJECT) -> Chuyển sang REJECTED kèm phản hồi")
        void shouldAllowStaffToRejectToRejectedStatus() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion));

            StaffReviewDecisionRequest req = StaffReviewDecisionRequest.builder()
                    .decision("REJECT")
                    .comment("Thiếu tài liệu mô tả các API endpoints quan trọng.")
                    .build();

            DocumentResponse response = documentService.processStaffReview(10L, req, 201L, "STAFF");

            assertNotNull(response);
            assertEquals(DocumentStatus.REJECTED, response.getStatus());
            verify(documentRepositoryPort).save(argThat(doc -> doc.getStatus() == DocumentStatus.REJECTED));
        }

        @Test
        @DisplayName("Manager cũng có thể thực hiện duyệt cấp 1 thành công")
        void shouldAllowManagerToPerformLevel1Review() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion));

            StaffReviewDecisionRequest req = StaffReviewDecisionRequest.builder()
                    .decision("APPROVE")
                    .comment("Manager trực tiếp xem xét cấp 1.")
                    .build();

            DocumentResponse response = documentService.processStaffReview(10L, req, 301L, "MANAGER");

            assertNotNull(response);
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, response.getStatus());
        }

        @Test
        @DisplayName("Chặn Developer cố tình duyệt cấp 1 -> Ném UnauthorizedDocumentReviewException")
        void shouldBlockDeveloperFromPerformingLevel1Review() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));

            StaffReviewDecisionRequest req = StaffReviewDecisionRequest.builder()
                    .decision("APPROVE")
                    .comment("Tác giả tự duyệt cho chính mình.")
                    .build();

            UnauthorizedDocumentReviewException ex = assertThrows(
                    UnauthorizedDocumentReviewException.class,
                    () -> documentService.processStaffReview(10L, req, 101L, "DEVELOPER"));

            assertTrue(ex.getMessage().contains("Từ chối quyền truy cập"));
            verify(documentRepositoryPort, never()).save(any());
        }
    }

    @Nested
    @DisplayName("3. Xử lý duyệt cấp 2 - Manager Review (processManagerReview)")
    class ManagerReviewTests {

        @BeforeEach
        void setDocToUnderReviewManager() {
            sampleDoc.setStatus(DocumentStatus.UNDER_REVIEW_MANAGER);
        }

        @Test
        @DisplayName("Manager phê duyệt (APPROVE) -> Chuyển thẳng sang PUBLISHED")
        void shouldAllowManagerToApproveToPublished() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion));

            ManagerReviewDecisionRequest req = ManagerReviewDecisionRequest.builder()
                    .decision("APPROVE")
                    .comment("Phê duyệt chính thức xuất bản lên wiki kho lưu trữ.")
                    .build();

            DocumentResponse response = documentService.processManagerReview(10L, req, 301L, "MANAGER");

            assertNotNull(response);
            assertEquals(DocumentStatus.PUBLISHED, response.getStatus());
            verify(documentRepositoryPort).save(argThat(doc -> doc.getStatus() == DocumentStatus.PUBLISHED));
        }

        @Test
        @DisplayName("Manager từ chối (REJECT) -> Chuyển sang REJECTED")
        void shouldAllowManagerToRejectDocument() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));
            when(documentRepositoryPort.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
            when(documentVersionRepositoryPort.findLatestByDocId(10L)).thenReturn(Optional.of(sampleVersion));

            ManagerReviewDecisionRequest req = ManagerReviewDecisionRequest.builder()
                    .decision("REJECT")
                    .comment("Cần xem xét lại bản quyền và thông tin bảo mật.")
                    .build();

            DocumentResponse response = documentService.processManagerReview(10L, req, 301L, "MANAGER");

            assertNotNull(response);
            assertEquals(DocumentStatus.REJECTED, response.getStatus());
            verify(documentRepositoryPort).save(argThat(doc -> doc.getStatus() == DocumentStatus.REJECTED));
        }

        @Test
        @DisplayName("Chặn Staff duyệt cấp 2 -> Ném UnauthorizedDocumentReviewException (Chỉ Manager mới được duyệt)")
        void shouldBlockStaffFromPerformingLevel2Review() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));

            ManagerReviewDecisionRequest req = ManagerReviewDecisionRequest.builder()
                    .decision("APPROVE")
                    .comment("Staff cố tình xuất bản tài liệu.")
                    .build();

            UnauthorizedDocumentReviewException ex = assertThrows(
                    UnauthorizedDocumentReviewException.class,
                    () -> documentService.processManagerReview(10L, req, 201L, "STAFF"));

            assertTrue(ex.getMessage().contains("Từ chối quyền truy cập"));
            verify(documentRepositoryPort, never()).save(any());
        }

        @Test
        @DisplayName("Chặn Developer duyệt cấp 2 -> Ném UnauthorizedDocumentReviewException")
        void shouldBlockDeveloperFromPerformingLevel2Review() {
            when(documentRepositoryPort.findById(10L)).thenReturn(Optional.of(sampleDoc));

            ManagerReviewDecisionRequest req = ManagerReviewDecisionRequest.builder()
                    .decision("APPROVE")
                    .comment("Dev cố tình xuất bản tài liệu.")
                    .build();

            assertThrows(
                    UnauthorizedDocumentReviewException.class,
                    () -> documentService.processManagerReview(10L, req, 101L, "DEVELOPER"));

            verify(documentRepositoryPort, never()).save(any());
        }
    }
}
