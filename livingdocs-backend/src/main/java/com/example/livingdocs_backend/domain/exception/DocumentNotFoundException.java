package com.example.livingdocs_backend.domain.exception;

public class DocumentNotFoundException extends RuntimeException {
    public DocumentNotFoundException(Long docId) {
        super("Không tìm thấy tài liệu với mã ID: " + docId);
    }
}
