package com.example.livingdocs_backend.domain.exception;

public class DocumentVersionNotFoundException extends RuntimeException {
    public DocumentVersionNotFoundException(Long docId, Integer versionNum) {
        super("Không tìm thấy phiên bản " + versionNum + " của tài liệu ID: " + docId);
    }
}
