-- ==============================================================================
-- LivingDocs - V3__create_jobs_table.sql
-- Flyway Database Migration: Khởi tạo bảng jobs cho hệ thống xử lý tác vụ bất đồng bộ nội bộ
-- Tác giả: TV2 (Thành viên 2 - Module Jobs & Background Worker)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS jobs (
    job_id BIGSERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index tối ưu hóa việc worker truy vấn các job chờ xử lý
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs (type);
