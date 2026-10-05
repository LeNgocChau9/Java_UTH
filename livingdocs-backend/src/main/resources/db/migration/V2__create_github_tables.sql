-- ==============================================================================
-- LivingDocs - V2__create_github_tables.sql
-- Flyway Database Migration: Khởi tạo module GitHub (Connections, Repositories, PRs, Commits, Code Entities)
-- Tác giả: TV2 (Thành viên 2 - Module GitHub & Webhooks)
-- ==============================================================================

-- 1. Bảng github_connections: Lưu trữ thông tin kết nối OAuth và Access Token đã mã hóa
CREATE TABLE IF NOT EXISTS github_connections (
    connection_id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    github_user_id BIGINT,
    github_username VARCHAR(100) NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    token_scope VARCHAR(255),
    token_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'CONNECTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gh_conn_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_gh_conn_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT uk_gh_conn_workspace_user UNIQUE (workspace_id, user_id)
);

-- 2. Bảng repositories: Lưu danh sách kho lưu trữ GitHub được kết nối vào workspace
CREATE TABLE IF NOT EXISTS repositories (
    repository_id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    connection_id BIGINT NOT NULL,
    github_repo_id BIGINT NOT NULL,
    repo_name VARCHAR(150) NOT NULL,
    repo_full_name VARCHAR(255) NOT NULL,
    default_branch VARCHAR(100) NOT NULL DEFAULT 'main',
    clone_url VARCHAR(500),
    webhook_id BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_doc_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_repo_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_repo_connection FOREIGN KEY (connection_id) REFERENCES github_connections (connection_id) ON DELETE RESTRICT,
    CONSTRAINT uk_repo_workspace_github_id UNIQUE (workspace_id, github_repo_id)
);

-- 3. Bảng pull_requests: Lưu danh sách và trạng thái Pull Request nhận từ GitHub
CREATE TABLE IF NOT EXISTS pull_requests (
    pr_id BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    github_pr_id BIGINT NOT NULL,
    pr_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    head_branch VARCHAR(150) NOT NULL,
    base_branch VARCHAR(150) NOT NULL,
    head_commit_hash VARCHAR(64) NOT NULL,
    base_commit_hash VARCHAR(64) NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    author_username VARCHAR(100),
    github_created_at TIMESTAMP WITH TIME ZONE,
    github_updated_at TIMESTAMP WITH TIME ZONE,
    github_closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pr_repository FOREIGN KEY (repository_id) REFERENCES repositories (repository_id) ON DELETE CASCADE,
    CONSTRAINT uk_pr_repo_number UNIQUE (repository_id, pr_number)
);

-- 4. Bảng commits: Lưu lịch sử commit mã nguồn đồng bộ từ kho lưu trữ
CREATE TABLE IF NOT EXISTS commits (
    commit_id BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    commit_hash VARCHAR(64) NOT NULL,
    author_name VARCHAR(150) NOT NULL,
    author_email VARCHAR(255),
    commit_message TEXT NOT NULL,
    committed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    pr_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_commit_repository FOREIGN KEY (repository_id) REFERENCES repositories (repository_id) ON DELETE CASCADE,
    CONSTRAINT fk_commit_pr FOREIGN KEY (pr_id) REFERENCES pull_requests (pr_id) ON DELETE SET NULL,
    CONSTRAINT uk_commit_repo_hash UNIQUE (repository_id, commit_hash)
);

-- 5. Bảng code_entities: Lưu trữ các phần tử mã (Class, Method, Signature) bóc tách qua AST
CREATE TABLE IF NOT EXISTS code_entities (
    entity_id BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    class_name VARCHAR(255),
    method_name VARCHAR(255),
    signature TEXT,
    return_type VARCHAR(150),
    parameters TEXT,
    start_line INTEGER,
    end_line INTEGER,
    commit_hash VARCHAR(64) NOT NULL,
    doc_status VARCHAR(50) NOT NULL DEFAULT 'UNDOCUMENTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_entity_repository FOREIGN KEY (repository_id) REFERENCES repositories (repository_id) ON DELETE CASCADE
);

-- Chỉ mục (Indexes) tối ưu hóa tốc độ tìm kiếm và đối chiếu
CREATE INDEX IF NOT EXISTS idx_gh_conn_workspace ON github_connections (workspace_id);
CREATE INDEX IF NOT EXISTS idx_repo_workspace ON repositories (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pr_repo_state ON pull_requests (repository_id, state);
CREATE INDEX IF NOT EXISTS idx_commit_repo_hash ON commits (repository_id, commit_hash);
CREATE INDEX IF NOT EXISTS idx_code_entity_lookup ON code_entities (repository_id, file_path, class_name);
CREATE INDEX IF NOT EXISTS idx_code_entity_status ON code_entities (repository_id, doc_status);
