package com.example.livingdocs_backend.domain.model;

import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Quản lý nghiêm ngặt các bước chuyển đổi trạng thái của tài liệu trong hệ thống LivingDocs.
 * Ngăn chặn việc xuất bản tài liệu khi chưa qua đủ các bước xem xét (Staff) và phê duyệt (Manager).
 *
 * Quy tắc chuyển đổi:
 * - DRAFT chỉ được chuyển sang UNDER_REVIEW_STAFF.
 * - UNDER_REVIEW_STAFF chỉ được chuyển sang UNDER_REVIEW_MANAGER hoặc REJECTED.
 * - UNDER_REVIEW_MANAGER chỉ được chuyển sang APPROVED hoặc REJECTED.
 * - Chỉ tài liệu APPROVED mới được phép chuyển sang PUBLISHED.
 * - REJECTED (sau khi bị từ chối) có thể quay về DRAFT để tác giả chỉnh sửa lại.
 * - PUBLISHED là trạng thái đã xuất bản lên kho lưu trữ / hệ thống.
 */
public class DocumentStateMachine {

    private static final Map<DocumentStatus, Set<DocumentStatus>> VALID_TRANSITIONS = new EnumMap<>(DocumentStatus.class);

    static {
        // DRAFT chỉ được chuyển sang UNDER_REVIEW_STAFF
        VALID_TRANSITIONS.put(
                DocumentStatus.DRAFT,
                EnumSet.of(DocumentStatus.UNDER_REVIEW_STAFF)
        );

        // UNDER_REVIEW_STAFF chỉ được chuyển sang UNDER_REVIEW_MANAGER hoặc REJECTED
        VALID_TRANSITIONS.put(
                DocumentStatus.UNDER_REVIEW_STAFF,
                EnumSet.of(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED)
        );

        // UNDER_REVIEW_MANAGER chỉ được chuyển sang APPROVED hoặc REJECTED
        VALID_TRANSITIONS.put(
                DocumentStatus.UNDER_REVIEW_MANAGER,
                EnumSet.of(DocumentStatus.APPROVED, DocumentStatus.REJECTED)
        );

        // Chỉ tài liệu APPROVED mới được phép chuyển sang PUBLISHED
        VALID_TRANSITIONS.put(
                DocumentStatus.APPROVED,
                EnumSet.of(DocumentStatus.PUBLISHED)
        );

        // Khi bị REJECTED, tác giả có thể đưa về DRAFT để chỉnh sửa bổ sung
        VALID_TRANSITIONS.put(
                DocumentStatus.REJECTED,
                EnumSet.of(DocumentStatus.DRAFT)
        );

        // PUBLISHED: Đã xuất bản, không chuyển trực tiếp mà phải qua phiên bản mới hoặc cập nhật
        VALID_TRANSITIONS.put(
                DocumentStatus.PUBLISHED,
                Collections.emptySet()
        );
    }

    private DocumentStateMachine() {
        // Ngăn khởi tạo instance vì đây là utility/domain service logic
    }

    /**
     * Kiểm tra xem việc chuyển đổi từ trạng thái fromStatus sang toStatus có hợp lệ hay không.
     *
     * @param fromStatus Trạng thái hiện tại
     * @param toStatus   Trạng thái đích muốn chuyển sang
     * @return true nếu hợp lệ, false nếu không hợp lệ
     */
    public static boolean isValidTransition(DocumentStatus fromStatus, DocumentStatus toStatus) {
        if (fromStatus == null || toStatus == null) {
            return false;
        }
        Set<DocumentStatus> allowedNextStatuses = VALID_TRANSITIONS.get(fromStatus);
        return allowedNextStatuses != null && allowedNextStatuses.contains(toStatus);
    }

    /**
     * Xác thực và chuyển đổi trạng thái nghiêm ngặt.
     * Ném ra ngoại lệ rõ ràng InvalidDocumentStatusTransitionException nếu chuyển đổi trái quy tắc.
     *
     * @param fromStatus Trạng thái hiện tại
     * @param toStatus   Trạng thái muốn chuyển sang
     * @return Trạng thái mới (toStatus) nếu hợp lệ
     * @throws InvalidDocumentStatusTransitionException nếu chuyển đổi không hợp lệ
     */
    public static DocumentStatus transition(DocumentStatus fromStatus, DocumentStatus toStatus) {
        if (!isValidTransition(fromStatus, toStatus)) {
            throw new InvalidDocumentStatusTransitionException(fromStatus, toStatus);
        }
        return toStatus;
    }

    /**
     * Lấy danh sách các trạng thái kế tiếp được phép từ trạng thái hiện tại.
     *
     * @param currentStatus Trạng thái hiện tại
     * @return Tập hợp các trạng thái hợp lệ tiếp theo
     */
    public static Set<DocumentStatus> getNextAllowedStatuses(DocumentStatus currentStatus) {
        if (currentStatus == null) {
            return Collections.emptySet();
        }
        Set<DocumentStatus> allowed = VALID_TRANSITIONS.get(currentStatus);
        return allowed != null ? Collections.unmodifiableSet(allowed) : Collections.emptySet();
    }
}
