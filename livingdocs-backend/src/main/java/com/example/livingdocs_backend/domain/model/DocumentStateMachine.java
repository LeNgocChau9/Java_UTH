package com.example.livingdocs_backend.domain.model;

import com.example.livingdocs_backend.domain.exception.InvalidDocumentStatusTransitionException;
import com.example.livingdocs_backend.domain.exception.UnauthorizedDocumentReviewException;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Quản lý nghiêm ngặt các bước chuyển đổi trạng thái của tài liệu trong hệ thống LivingDocs.
 * Ngăn chặn việc xuất bản tài liệu khi chưa qua đủ các bước xem xét (Staff - Cấp 1) và phê duyệt (Manager - Cấp 2).
 *
 * Quy tắc chuyển đổi nghiêm ngặt:
 * - DRAFT ➔ UNDER_REVIEW_STAFF (Gửi duyệt).
 * - UNDER_REVIEW_STAFF ➔ UNDER_REVIEW_MANAGER hoặc REJECTED (Duyệt cấp 1: Chỉ STAFF hoặc MANAGER mới có quyền).
 * - UNDER_REVIEW_MANAGER ➔ PUBLISHED (hoặc APPROVED) hoặc REJECTED (Duyệt cấp 2: Chỉ MANAGER mới có quyền).
 * - APPROVED ➔ PUBLISHED (Xuất bản).
 * - REJECTED (sau khi bị từ chối) ➔ DRAFT để tác giả chỉnh sửa lại.
 * - PUBLISHED: Trạng thái xuất bản cuối cùng.
 */
public class DocumentStateMachine {

    /**
     * Khóa định danh cặp chuyển đổi trạng thái (fromStatus -> toStatus).
     */
    public record TransitionKey(DocumentStatus from, DocumentStatus to) {
        public TransitionKey {
            Objects.requireNonNull(from, "fromStatus không được null");
            Objects.requireNonNull(to, "toStatus không được null");
        }
    }

    private static final Map<DocumentStatus, Set<DocumentStatus>> VALID_TRANSITIONS = new EnumMap<>(DocumentStatus.class);
    private static final Map<TransitionKey, Set<String>> ALLOWED_ROLES_PER_TRANSITION = new HashMap<>();

    // Các vai trò mặc định
    private static final Set<String> LEVEL_1_REVIEWERS = Set.of("STAFF", "MANAGER", "ADMIN");
    private static final Set<String> LEVEL_2_REVIEWERS = Set.of("MANAGER", "ADMIN");
    private static final Set<String> ALL_ACTIVE_ACTORS = Set.of("DEVELOPER", "STAFF", "MANAGER", "TECH_LEAD", "ADMIN", "AI");

    static {
        // 1. DRAFT ➔ UNDER_REVIEW_STAFF
        VALID_TRANSITIONS.put(
                DocumentStatus.DRAFT,
                EnumSet.of(DocumentStatus.UNDER_REVIEW_STAFF)
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.DRAFT, DocumentStatus.UNDER_REVIEW_STAFF),
                ALL_ACTIVE_ACTORS
        );

        // 2. UNDER_REVIEW_STAFF ➔ UNDER_REVIEW_MANAGER hoặc REJECTED (Duyệt cấp 1: chỉ STAFF hoặc MANAGER)
        VALID_TRANSITIONS.put(
                DocumentStatus.UNDER_REVIEW_STAFF,
                EnumSet.of(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED)
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.UNDER_REVIEW_MANAGER),
                LEVEL_1_REVIEWERS
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.UNDER_REVIEW_STAFF, DocumentStatus.REJECTED),
                LEVEL_1_REVIEWERS
        );

        // 3. UNDER_REVIEW_MANAGER ➔ PUBLISHED hoặc APPROVED hoặc REJECTED (Duyệt cấp 2: chỉ MANAGER)
        VALID_TRANSITIONS.put(
                DocumentStatus.UNDER_REVIEW_MANAGER,
                EnumSet.of(DocumentStatus.PUBLISHED, DocumentStatus.APPROVED, DocumentStatus.REJECTED)
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.PUBLISHED),
                LEVEL_2_REVIEWERS
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.APPROVED),
                LEVEL_2_REVIEWERS
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.UNDER_REVIEW_MANAGER, DocumentStatus.REJECTED),
                LEVEL_2_REVIEWERS
        );

        // 4. APPROVED ➔ PUBLISHED
        VALID_TRANSITIONS.put(
                DocumentStatus.APPROVED,
                EnumSet.of(DocumentStatus.PUBLISHED)
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.APPROVED, DocumentStatus.PUBLISHED),
                LEVEL_2_REVIEWERS
        );

        // 5. REJECTED ➔ DRAFT
        VALID_TRANSITIONS.put(
                DocumentStatus.REJECTED,
                EnumSet.of(DocumentStatus.DRAFT)
        );
        ALLOWED_ROLES_PER_TRANSITION.put(
                new TransitionKey(DocumentStatus.REJECTED, DocumentStatus.DRAFT),
                ALL_ACTIVE_ACTORS
        );

        // 6. PUBLISHED (Terminal state)
        VALID_TRANSITIONS.put(
                DocumentStatus.PUBLISHED,
                Collections.emptySet()
        );
    }

    private DocumentStateMachine() {
        // Ngăn khởi tạo instance vì đây là Domain Service logic thuần túy
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
     * Xác thực và chuyển đổi trạng thái nghiêm ngặt (chỉ kiểm tra luồng trạng thái).
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
     * Chuẩn hóa tên vai trò: loại bỏ prefix 'ROLE_', trim whitespace và chuyển về chữ in hoa.
     */
    public static String normalizeRole(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            return "";
        }
        String clean = roleName.trim().toUpperCase();
        if (clean.startsWith("ROLE_")) {
            clean = clean.substring(5);
        }
        return clean;
    }

    /**
     * Kiểm tra xem vai trò chỉ định có quyền thực hiện bước chuyển đổi trạng thái này hay không.
     *
     * @param fromStatus Trạng thái ban đầu
     * @param toStatus   Trạng thái đích
     * @param roleName   Tên vai trò của người thực hiện (vd: "STAFF", "MANAGER", "ROLE_DEVELOPER")
     * @return true nếu vai trò được phép, false nếu không đủ quyền hạn
     */
    public static boolean isAllowedRole(DocumentStatus fromStatus, DocumentStatus toStatus, String roleName) {
        if (fromStatus == null || toStatus == null || roleName == null || roleName.isBlank()) {
            return false;
        }
        TransitionKey key = new TransitionKey(fromStatus, toStatus);
        Set<String> allowedRoles = ALLOWED_ROLES_PER_TRANSITION.get(key);
        if (allowedRoles == null) {
            return false;
        }
        String normalized = normalizeRole(roleName);
        return allowedRoles.contains(normalized);
    }

    /**
     * Lấy danh sách các vai trò được phép thực hiện bước chuyển đổi tương ứng.
     *
     * @param fromStatus Trạng thái ban đầu
     * @param toStatus   Trạng thái đích
     * @return Tập hợp các vai trò hợp lệ
     */
    public static Set<String> getAllowedRoles(DocumentStatus fromStatus, DocumentStatus toStatus) {
        if (fromStatus == null || toStatus == null) {
            return Collections.emptySet();
        }
        Set<String> roles = ALLOWED_ROLES_PER_TRANSITION.get(new TransitionKey(fromStatus, toStatus));
        return roles != null ? Collections.unmodifiableSet(roles) : Collections.emptySet();
    }

    /**
     * Chuyển đổi trạng thái nghiêm ngặt kèm kiểm tra quyền hạn (Role Authorization).
     *
     * @param fromStatus Trạng thái hiện tại
     * @param toStatus   Trạng thái muốn chuyển sang
     * @param roleName   Vai trò của người thực hiện
     * @return Trạng thái mới nếu hợp lệ cả về luồng trạng thái lẫn quyền hạn
     * @throws InvalidDocumentStatusTransitionException nếu sai luồng trạng thái
     * @throws UnauthorizedDocumentReviewException      nếu không đủ quyền hạn
     */
    public static DocumentStatus transition(DocumentStatus fromStatus, DocumentStatus toStatus, String roleName) {
        // 1. Kiểm tra luồng trạng thái hợp lệ
        if (!isValidTransition(fromStatus, toStatus)) {
            throw new InvalidDocumentStatusTransitionException(fromStatus, toStatus);
        }

        // 2. Kiểm tra quyền hạn tương ứng
        if (!isAllowedRole(fromStatus, toStatus, roleName)) {
            Set<String> allowed = getAllowedRoles(fromStatus, toStatus);
            throw new UnauthorizedDocumentReviewException(fromStatus, toStatus, roleName, allowed);
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
