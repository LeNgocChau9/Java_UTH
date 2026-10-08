-- ==============================================================================
-- LivingDocs - V3__create_document_tables.sql
-- Flyway Database Migration: Khởi tạo module Tài liệu (Doc Collections, Documents, Document Versions, Reviews, Review Comments)
-- Tác giả: TV3 (Thành viên 3 - Module Tài liệu)
-- ==============================================================================

-- 1. Bảng doc_collections: Phân loại tài liệu theo bộ sưu tập.
CREATE TABLE IF NOT EXISTS doc_collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng documents: Lưu doc_id, repo_id, title, target_path, status, current_version.
CREATE TABLE IF NOT EXISTS documents (
    doc_id SERIAL PRIMARY KEY,
    collection_id INT REFERENCES doc_collections(id) ON DELETE SET NULL,
    repo_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    target_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'DRAFT',
    current_version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng document_versions: Lưu version_id, doc_id, version_num, content, actor_role, trigger_type, hash, prev_hash.
CREATE TABLE IF NOT EXISTS document_versions (
    version_id SERIAL PRIMARY KEY,
    doc_id INT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    version_num INT NOT NULL,
    content TEXT,
    actor_role VARCHAR(50) CHECK (actor_role IN ('AI', 'DEV', 'STAFF', 'MANAGER')),
    trigger_type VARCHAR(100),
    hash VARCHAR(256),
    prev_hash VARCHAR(256),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng reviews: Lưu lượt xem xét, người duyệt, nhận xét và kết quả.
CREATE TABLE IF NOT EXISTS reviews (
    review_id SERIAL PRIMARY KEY,
    doc_id INT REFERENCES documents(doc_id) ON DELETE CASCADE,
    version_id INT REFERENCES document_versions(version_id) ON DELETE CASCADE,
    reviewer VARCHAR(100) NOT NULL, -- Có thể là ID người duyệt hoặc username
    general_comment TEXT,
    result VARCHAR(50) DEFAULT 'PENDING', -- VD: 'APPROVED', 'REJECTED', 'PENDING'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng review_comments: Lưu nhận xét chi tiết theo từng đoạn văn bản.
CREATE TABLE IF NOT EXISTS review_comments (
    comment_id SERIAL PRIMARY KEY, 
    review_id INT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
    text_segment VARCHAR(255), -- Vị trí hoặc trích dẫn đoạn văn bản
    detailed_comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);