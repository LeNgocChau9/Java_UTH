package com.example.livingdocs_backend.domain.exception;

import com.example.livingdocs_backend.domain.model.DocumentStatus;

import java.util.Collections;
import java.util.Set;

/**
 * Ngoại lệ ném ra khi người dùng không đủ quyền hạn (Role Permission)
 * để thực hiện duyệt tài liệu ở cấp tương ứng (cấp 1 - Staff hoặc cấp 2 - Manager).
 */
public class UnauthorizedDocumentReviewException extends RuntimeException {

    private final DocumentStatus currentStatus;
    private final DocumentStatus targetStatus;
    private final String actualRole;
    private final Set<String> requiredRoles;

    public UnauthorizedDocumentReviewException(DocumentStatus currentStatus,
                                               DocumentStatus targetStatus,
                                               String actualRole,
                                               Set<String> requiredRoles) {
        super(formatMessage(currentStatus, targetStatus, actualRole, requiredRoles));
        this.currentStatus = currentStatus;
        this.targetStatus = targetStatus;
        this.actualRole = actualRole;
        this.requiredRoles = requiredRoles != null ? Collections.unmodifiableSet(requiredRoles) : Collections.emptySet();
    }

    public UnauthorizedDocumentReviewException(String message) {
        super(message);
        this.currentStatus = null;
        this.targetStatus = null;
        this.actualRole = null;
        this.requiredRoles = Collections.emptySet();
    }

    private static String formatMessage(DocumentStatus currentStatus,
                                         DocumentStatus targetStatus,
                                         String actualRole,
                                         Set<String> requiredRoles) {
        String roleStr = (actualRole != null && !actualRole.isBlank()) ? actualRole.trim().toUpperCase() : "UNKNOWN";
        String requiredStr = (requiredRoles != null && !requiredRoles.isEmpty())
                ? String.join(" hoặc ", requiredRoles)
                : "Không xác định";

        return String.format(
                "Từ chối quyền truy cập: Người dùng với vai trò '%s' không có quyền duyệt chuyển trạng thái từ '%s' sang '%s'. Yêu cầu vai trò: %s.",
                roleStr,
                currentStatus != null ? currentStatus.name() : "NULL",
                targetStatus != null ? targetStatus.name() : "NULL",
                requiredStr
        );
    }

    public DocumentStatus getCurrentStatus() {
        return currentStatus;
    }

    public DocumentStatus getTargetStatus() {
        return targetStatus;
    }

    public String getActualRole() {
        return actualRole;
    }

    public Set<String> getRequiredRoles() {
        return requiredRoles;
    }
}
