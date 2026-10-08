package com.example.livingdocs_backend.domain.model;

/**
 * Định nghĩa các trạng thái trong vòng đời tài liệu của LivingDocs.
 * Luồng phê duyệt nghiêm ngặt:
 * DRAFT -> UNDER_REVIEW_STAFF -> UNDER_REVIEW_MANAGER -> APPROVED -> PUBLISHED
 * (hoặc chuyển sang REJECTED từ UNDER_REVIEW_STAFF / UNDER_REVIEW_MANAGER).
 */
public enum DocumentStatus {
    DRAFT,
    UNDER_REVIEW_STAFF,
    UNDER_REVIEW_MANAGER,
    APPROVED,
    REJECTED,
    PUBLISHED
}
