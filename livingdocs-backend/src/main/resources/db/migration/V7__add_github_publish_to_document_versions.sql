-- ==============================================================================
-- LivingDocs - V6__add_github_publish_to_document_versions.sql
-- Flyway Migration: Thêm cột lưu thông tin xuất bản lên GitHub
-- commit_hash: SHA của commit tạo ra khi publish tài liệu
-- commit_url : URL HTML trực tiếp đến commit trên GitHub
-- published_at: Thời điểm xuất bản
-- ==============================================================================

ALTER TABLE document_versions
    ADD COLUMN IF NOT EXISTS commit_hash  VARCHAR(256),
    ADD COLUMN IF NOT EXISTS commit_url   VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
