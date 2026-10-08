package com.example.livingdocs_backend.domain.exception;

import com.example.livingdocs_backend.domain.model.DocumentStatus;

/**
 * Ngoại lệ ném ra khi cố tình chuyển trạng thái tài liệu trái với quy tắc máy trạng thái.
 */
public class InvalidDocumentStatusTransitionException extends RuntimeException {

    private final DocumentStatus fromStatus;
    private final DocumentStatus toStatus;

    public InvalidDocumentStatusTransitionException(DocumentStatus fromStatus, DocumentStatus toStatus) {
        super(String.format("Không thể chuyển đổi trạng thái tài liệu từ '%s' sang '%s'. Chuyển đổi không hợp lệ!",
                fromStatus != null ? fromStatus.name() : "NULL",
                toStatus != null ? toStatus.name() : "NULL"));
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
    }

    public InvalidDocumentStatusTransitionException(String message) {
        super(message);
        this.fromStatus = null;
        this.toStatus = null;
    }

    public DocumentStatus getFromStatus() {
        return fromStatus;
    }

    public DocumentStatus getToStatus() {
        return toStatus;
    }
}
