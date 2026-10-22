-- ==============================================================================
-- LivingDocs - V6__alter_reviews_to_bigint.sql
-- Flyway Database Migration: Nâng cấp kiểu dữ liệu review_id, doc_id, version_id sang BIGINT
-- ==============================================================================

ALTER TABLE reviews ALTER COLUMN review_id TYPE BIGINT;
ALTER TABLE reviews ALTER COLUMN doc_id TYPE BIGINT;
ALTER TABLE reviews ALTER COLUMN version_id TYPE BIGINT;
