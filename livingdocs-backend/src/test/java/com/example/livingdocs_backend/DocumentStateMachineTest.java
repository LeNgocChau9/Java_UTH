package com.example.livingdocs_backend;

import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;
import com.example.livingdocs_backend.domain.exception.UnauthorizedDocumentReviewException;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử logic bộ máy trạng thái tài liệu - DocumentStateMachine")
class DocumentStateMachineTest {

    @Nested
    @DisplayName("1. Kiểm thử luồng trạng thái nghiêm ngặt (Strict Enum State Transitions)")
    class StateTransitionTests {

        @Test
        @DisplayName("DRAFT chỉ được phép chuyển sang UNDER_REVIEW_STAFF")
        void shouldAllowTransitionFromDraftToUnderReviewStaff() {
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.DRAFT, DocumentStatus.UNDER_REVIEW_STAFF));
            DocumentStatus newStatus = DocumentStateMachine.transition(DocumentStatus.DRAFT, DocumentStatus.UNDER_REVIEW_STAFF);
            assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, newStatus);
        }

        @Test
        @DisplayName("UNDER_REVIEW_STAFF chỉ được chuyển sang UNDER_REVIEW_MANAGER hoặc REJECTED (Duyệt cấp 1)")
        void shouldAllowTransitionsFromUnderReviewStaff() {
            // Chuyển tiếp lên Manager sau khi Staff duyệt thành công
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER));
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER,
                    DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER));

            // Nhân viên từ chối tài liệu
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED));
            assertEquals(DocumentStatus.REJECTED,
                    DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED));
        }

        @Test
        @DisplayName("UNDER_REVIEW_MANAGER chuyển sang PUBLISHED, APPROVED, REJECTED hoặc trả lại UNDER_REVIEW_STAFF (Duyệt cấp 2)")
        void shouldAllowTransitionsFromUnderReviewManager() {
            // Quản lý phê duyệt trực tiếp xuất bản (theo đúng mô tả Task tuần 3)
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED));
            assertEquals(DocumentStatus.PUBLISHED,
                    DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED));

            // Quản lý phê duyệt (trạng thái APPROVED)
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED));
            assertEquals(DocumentStatus.APPROVED,
                    DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED));

            // Quản lý từ chối
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED));
            assertEquals(DocumentStatus.REJECTED,
                    DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED));

            // Quản lý trả lại cho Staff xem xét lại
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.UNDER_REVIEW_STAFF));
            assertEquals(DocumentStatus.UNDER_REVIEW_STAFF,
                    DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.UNDER_REVIEW_STAFF));
        }

        @Test
        @DisplayName("Tài liệu APPROVED được phép chuyển sang PUBLISHED")
        void shouldAllowTransitionFromApprovedToPublished() {
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.APPROVED, DocumentStatus.PUBLISHED));
            assertEquals(DocumentStatus.PUBLISHED,
                    DocumentStateMachine.transition(DocumentStatus.APPROVED, DocumentStatus.PUBLISHED));
        }

        @Test
        @DisplayName("Tài liệu REJECTED có thể quay lại DRAFT để tác giả chỉnh sửa")
        void shouldAllowTransitionFromRejectedToDraft() {
            assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.REJECTED, DocumentStatus.DRAFT));
            assertEquals(DocumentStatus.DRAFT,
                    DocumentStateMachine.transition(DocumentStatus.REJECTED, DocumentStatus.DRAFT));
        }

        @Test
        @DisplayName("Chặn tuyệt đối: Nhảy cóc từ DRAFT trực tiếp lên PUBLISHED và ném ngoại lệ rõ ràng")
        void shouldBlockDirectJumpFromDraftToPublished() {
            assertFalse(DocumentStateMachine.isValidTransition(DocumentStatus.DRAFT, DocumentStatus.PUBLISHED));

            InvalidDocumentStatusTransitionException exception = assertThrows(
                    InvalidDocumentStatusTransitionException.class,
                    () -> DocumentStateMachine.transition(DocumentStatus.DRAFT, DocumentStatus.PUBLISHED)
            );

            assertEquals(DocumentStatus.DRAFT, exception.getFromStatus());
            assertEquals(DocumentStatus.PUBLISHED, exception.getToStatus());
            assertTrue(exception.getMessage().contains("DRAFT"));
            assertTrue(exception.getMessage().contains("PUBLISHED"));
        }

        @ParameterizedTest(name = "Chặn chuyển đổi từ {0} sang {1}")
        @CsvSource({
                "DRAFT, APPROVED",
                "DRAFT, UNDER_REVIEW_MANAGER",
                "DRAFT, REJECTED",
                "UNDER_REVIEW_STAFF, PUBLISHED",
                "UNDER_REVIEW_STAFF, APPROVED",
                "UNDER_REVIEW_STAFF, DRAFT",
                "UNDER_REVIEW_MANAGER, DRAFT",
                "APPROVED, DRAFT",
                "APPROVED, UNDER_REVIEW_STAFF",
                "APPROVED, UNDER_REVIEW_MANAGER",
                "APPROVED, REJECTED",
                "REJECTED, PUBLISHED",
                "REJECTED, APPROVED",
                "REJECTED, UNDER_REVIEW_MANAGER",
                "PUBLISHED, DRAFT",
                "PUBLISHED, UNDER_REVIEW_STAFF"
        })
        @DisplayName("Chặn tất cả các trường hợp chuyển đổi trái quy tắc và ném ngoại lệ")
        void shouldBlockAllInvalidTransitions(DocumentStatus from, DocumentStatus to) {
            assertFalse(DocumentStateMachine.isValidTransition(from, to));

            InvalidDocumentStatusTransitionException exception = assertThrows(
                    InvalidDocumentStatusTransitionException.class,
                    () -> DocumentStateMachine.transition(from, to)
            );

            assertEquals(from, exception.getFromStatus());
            assertEquals(to, exception.getToStatus());
        }

        @Test
        @DisplayName("Kiểm tra danh sách trạng thái kế tiếp được phép (getNextAllowedStatuses)")
        void shouldReturnCorrectAllowedNextStatuses() {
            Set<DocumentStatus> fromDraft = DocumentStateMachine.getNextAllowedStatuses(DocumentStatus.DRAFT);
            assertEquals(1, fromDraft.size());
            assertTrue(fromDraft.contains(DocumentStatus.UNDER_REVIEW_STAFF));

            Set<DocumentStatus> fromStaff = DocumentStateMachine.getNextAllowedStatuses(DocumentStatus.UNDER_REVIEW_STAFF);
            assertEquals(2, fromStaff.size());
            assertTrue(fromStaff.contains(DocumentStatus.UNDER_REVIEW_MANAGER));
            assertTrue(fromStaff.contains(DocumentStatus.REJECTED));

            Set<DocumentStatus> fromManager = DocumentStateMachine.getNextAllowedStatuses(DocumentStatus.UNDER_REVIEW_MANAGER);
            assertEquals(4, fromManager.size());
            assertTrue(fromManager.contains(DocumentStatus.PUBLISHED));
            assertTrue(fromManager.contains(DocumentStatus.APPROVED));
            assertTrue(fromManager.contains(DocumentStatus.REJECTED));
            assertTrue(fromManager.contains(DocumentStatus.UNDER_REVIEW_STAFF));

            Set<DocumentStatus> fromApproved = DocumentStateMachine.getNextAllowedStatuses(DocumentStatus.APPROVED);
            assertEquals(1, fromApproved.size());
            assertTrue(fromApproved.contains(DocumentStatus.PUBLISHED));

            Set<DocumentStatus> fromPublished = DocumentStateMachine.getNextAllowedStatuses(DocumentStatus.PUBLISHED);
            assertTrue(fromPublished.isEmpty());
        }

        @Test
        @DisplayName("Xử lý an toàn khi truyền null: isValidTransition trả về false và transition ném ngoại lệ")
        void shouldHandleNullGracefully() {
            assertFalse(DocumentStateMachine.isValidTransition(null, DocumentStatus.DRAFT));
            assertFalse(DocumentStateMachine.isValidTransition(DocumentStatus.DRAFT, null));
            assertFalse(DocumentStateMachine.isValidTransition(null, null));

            assertThrows(InvalidDocumentStatusTransitionException.class,
                    () -> DocumentStateMachine.transition(null, DocumentStatus.DRAFT));
        }
    }

    @Nested
    @DisplayName("2. Kiểm thử kiểm tra quyền hạn (Role-based Review Permissions)")
    class RolePermissionTests {

        @ParameterizedTest(name = "Vai trò hợp lệ duyệt cấp 1: {0}")
        @ValueSource(strings = {"STAFF", "MANAGER", "ADMIN", "ROLE_STAFF", "ROLE_MANAGER", "ROLE_ADMIN"})
        @DisplayName("Duyệt cấp 1: Chỉ STAFF hoặc MANAGER (hoặc ADMIN) mới được duyệt cấp 1")
        void shouldAllowLevel1ReviewByStaffOrManager(String role) {
            // Duyệt chấp nhận: UNDER_REVIEW_STAFF -> UNDER_REVIEW_MANAGER
            assertTrue(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, role));
            DocumentStatus approvedStatus = DocumentStateMachine.transition(
                    DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, role);
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, approvedStatus);

            // Duyệt từ chối: UNDER_REVIEW_STAFF -> REJECTED
            assertTrue(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED, role));
            DocumentStatus rejectedStatus = DocumentStateMachine.transition(
                    DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED, role);
            assertEquals(DocumentStatus.REJECTED, rejectedStatus);
        }

        @ParameterizedTest(name = "Vai trò không có quyền duyệt cấp 1: {0}")
        @ValueSource(strings = {"DEVELOPER", "TECH_LEAD", "AI", "DEV", "ROLE_DEVELOPER", "GUEST"})
        @DisplayName("Duyệt cấp 1: Chặn Developer, AI hoặc vai trò khác và ném UnauthorizedDocumentReviewException")
        void shouldBlockUnauthorizedRolesFromLevel1Review(String unauthorizedRole) {
            assertFalse(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, unauthorizedRole));

            UnauthorizedDocumentReviewException ex = assertThrows(
                    UnauthorizedDocumentReviewException.class,
                    () -> DocumentStateMachine.transition(
                            DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, unauthorizedRole)
            );

            assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, ex.getCurrentStatus());
            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, ex.getTargetStatus());
            assertTrue(ex.getRequiredRoles().contains("STAFF"));
            assertTrue(ex.getRequiredRoles().contains("MANAGER"));
            assertTrue(ex.getMessage().contains("Từ chối quyền truy cập"));
        }

        @ParameterizedTest(name = "Vai trò hợp lệ duyệt cấp 2: {0}")
        @ValueSource(strings = {"MANAGER", "ADMIN", "ROLE_MANAGER", "ROLE_ADMIN"})
        @DisplayName("Duyệt cấp 2: Chỉ MANAGER mới có quyền phê duyệt cấp 2")
        void shouldAllowLevel2ReviewOnlyByManager(String role) {
            // Manager phê duyệt xuất bản trực tiếp sang PUBLISHED
            assertTrue(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED, role));
            DocumentStatus publishedStatus = DocumentStateMachine.transition(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED, role);
            assertEquals(DocumentStatus.PUBLISHED, publishedStatus);

            // Manager phê duyệt sang APPROVED
            assertTrue(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED, role));
            DocumentStatus approvedStatus = DocumentStateMachine.transition(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED, role);
            assertEquals(DocumentStatus.APPROVED, approvedStatus);

            // Manager từ chối sang REJECTED
            assertTrue(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED, role));
            DocumentStatus rejectedStatus = DocumentStateMachine.transition(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED, role);
            assertEquals(DocumentStatus.REJECTED, rejectedStatus);

            // Manager trả lại cho Staff xem xét lại sang UNDER_REVIEW_STAFF
            assertTrue(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.UNDER_REVIEW_STAFF, role));
            DocumentStatus returnStaffStatus = DocumentStateMachine.transition(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.UNDER_REVIEW_STAFF, role);
            assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, returnStaffStatus);
        }

        @ParameterizedTest(name = "Vai trò bị chặn duyệt cấp 2: {0}")
        @ValueSource(strings = {"STAFF", "DEVELOPER", "TECH_LEAD", "AI", "ROLE_STAFF", "ROLE_DEVELOPER"})
        @DisplayName("Duyệt cấp 2: Chặn Staff, Developer, AI và ném UnauthorizedDocumentReviewException")
        void shouldBlockStaffAndOthersFromLevel2Review(String forbiddenRole) {
            assertFalse(DocumentStateMachine.isAllowedRole(
                    DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED, forbiddenRole));

            UnauthorizedDocumentReviewException ex = assertThrows(
                    UnauthorizedDocumentReviewException.class,
                    () -> DocumentStateMachine.transition(
                            DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED, forbiddenRole)
            );

            assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER, ex.getCurrentStatus());
            assertEquals(DocumentStatus.PUBLISHED, ex.getTargetStatus());
            assertTrue(ex.getRequiredRoles().contains("MANAGER"));
            assertFalse(ex.getRequiredRoles().contains("STAFF")); // STAFF tuyệt đối không được duyệt cấp 2!
            assertTrue(ex.getMessage().contains("Từ chối quyền truy cập"));
        }

        @Test
        @DisplayName("Duyệt khi role là null hoặc rỗng -> Phải bị từ chối")
        void shouldRejectNullOrBlankRole() {
            assertFalse(DocumentStateMachine.isAllowedRole(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, null));
            assertFalse(DocumentStateMachine.isAllowedRole(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, "   "));

            assertThrows(UnauthorizedDocumentReviewException.class,
                    () -> DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER, null));

            assertThrows(UnauthorizedDocumentReviewException.class,
                    () -> DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED, ""));
        }

        @Test
        @DisplayName("Nhảy cóc sai luồng trạng thái thì luôn ném InvalidDocumentStatusTransitionException dù role có là MANAGER")
        void shouldThrowTransitionExceptionEvenForManagerIfTransitionIsInvalid() {
            assertThrows(InvalidDocumentStatusTransitionException.class,
                    () -> DocumentStateMachine.transition(DocumentStatus.DRAFT, DocumentStatus.PUBLISHED, "MANAGER"));
        }
    }
}
