package com.example.livingdocs_backend;

import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử logic máy trạng thái tài liệu - DocumentStateMachine")
class DocumentStateMachineTest {

    @Test
    @DisplayName("DRAFT chỉ được phép chuyển sang UNDER_REVIEW_STAFF")
    void shouldAllowTransitionFromDraftToUnderReviewStaff() {
        assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.DRAFT, DocumentStatus.UNDER_REVIEW_STAFF));
        DocumentStatus newStatus = DocumentStateMachine.transition(DocumentStatus.DRAFT, DocumentStatus.UNDER_REVIEW_STAFF);
        assertEquals(DocumentStatus.UNDER_REVIEW_STAFF, newStatus);
    }

    @Test
    @DisplayName("UNDER_REVIEW_STAFF chỉ được chuyển sang UNDER_REVIEW_MANAGER hoặc REJECTED")
    void shouldAllowTransitionsFromUnderReviewStaff() {
        // Chuyển sang cấp 2 (Manager)
        assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER));
        assertEquals(DocumentStatus.UNDER_REVIEW_MANAGER,
                DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER));

        // Nhân viên từ chối tài liệu
        assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED));
        assertEquals(DocumentStatus.REJECTED,
                DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED));
    }

    @Test
    @DisplayName("UNDER_REVIEW_MANAGER chỉ được chuyển sang APPROVED hoặc REJECTED")
    void shouldAllowTransitionsFromUnderReviewManager() {
        // Quản lý phê duyệt
        assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED));
        assertEquals(DocumentStatus.APPROVED,
                DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED));

        // Quản lý từ chối
        assertTrue(DocumentStateMachine.isValidTransition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED));
        assertEquals(DocumentStatus.REJECTED,
                DocumentStateMachine.transition(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED));
    }

    @Test
    @DisplayName("Chỉ tài liệu APPROVED mới được phép chuyển sang PUBLISHED")
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
            "UNDER_REVIEW_MANAGER, PUBLISHED",
            "UNDER_REVIEW_MANAGER, DRAFT",
            "UNDER_REVIEW_MANAGER, UNDER_REVIEW_STAFF",
            "APPROVED, DRAFT",
            "APPROVED, UNDER_REVIEW_STAFF",
            "APPROVED, UNDER_REVIEW_MANAGER",
            "APPROVED, REJECTED",
            "REJECTED, PUBLISHED",
            "REJECTED, APPROVED",
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
        assertEquals(2, fromManager.size());
        assertTrue(fromManager.contains(DocumentStatus.APPROVED));
        assertTrue(fromManager.contains(DocumentStatus.REJECTED));

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
