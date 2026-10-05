-- ==============================================================================
-- LivingDocs - V1__init_users_and_roles.sql
-- Flyway Database Migration: Khởi tạo bảng người dùng, workspace, phân quyền và audit logs
-- ==============================================================================

-- 1. Bảng roles: Định nghĩa 5 vai trò trong hệ thống
CREATE TABLE IF NOT EXISTS roles (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng users: Quản lý thông tin tài khoản người dùng
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    avatar_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng workspaces: Quản lý không gian làm việc của dự án
CREATE TABLE IF NOT EXISTS workspaces (
    workspace_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    owner_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users (user_id) ON DELETE RESTRICT
);

-- 4. Bảng workspace_members: Phân quyền thành viên theo workspace
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id),
    CONSTRAINT fk_wm_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_wm_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_wm_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE RESTRICT
);

-- 5. Bảng audit_logs: Ghi nhận nhật ký thao tác hệ thống
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    detail TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
);

-- ==============================================================================
-- SEED DATA: Nạp 5 vai trò và 5 tài khoản mẫu cho kiểm thử
-- Mật khẩu mặc định cho toàn bộ 5 tài khoản là: Password@123
-- BCrypt Hash ($2a$10$7010IiHxHU/dFsWyDkXHbuXK.tqsimYZualqvSGpXtY83mid4n/.S)
-- ==============================================================================

-- Nạp 5 vai trò
INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'ADMIN', 'Quản trị viên toàn hệ thống'),
(2, 'TECH_LEAD', 'Trưởng nhóm kỹ thuật, duyệt kiến trúc và tài liệu chuyên sâu'),
(3, 'MANAGER', 'Quản lý dự án, theo dõi tiến độ và phê duyệt tài liệu'),
(4, 'STAFF', 'Người rà soát, kiểm thử chất lượng và đóng góp tài liệu'),
(5, 'DEVELOPER', 'Lập trình viên, đồng bộ mã nguồn và cập nhật tài liệu kỹ thuật')
ON CONFLICT (role_name) DO NOTHING;

-- Nạp 5 tài khoản tương ứng 5 vai trò
INSERT INTO users (user_id, email, password_hash, full_name, avatar_url, status) VALUES
(1, 'admin@livingdocs.internal', '$2a$10$7010IiHxHU/dFsWyDkXHbuXK.tqsimYZualqvSGpXtY83mid4n/.S', 'System Administrator', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'ACTIVE'),
(2, 'techlead@livingdocs.internal', '$2a$10$7010IiHxHU/dFsWyDkXHbuXK.tqsimYZualqvSGpXtY83mid4n/.S', 'Nguyen Tech Lead', 'https://api.dicebear.com/7.x/avataaars/svg?seed=techlead', 'ACTIVE'),
(3, 'manager@livingdocs.internal', '$2a$10$7010IiHxHU/dFsWyDkXHbuXK.tqsimYZualqvSGpXtY83mid4n/.S', 'Tran Project Manager', 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager', 'ACTIVE'),
(4, 'staff@livingdocs.internal', '$2a$10$7010IiHxHU/dFsWyDkXHbuXK.tqsimYZualqvSGpXtY83mid4n/.S', 'Le Staff Reviewer', 'https://api.dicebear.com/7.x/avataaars/svg?seed=staff', 'ACTIVE'),
(5, 'developer@livingdocs.internal', '$2a$10$7010IiHxHU/dFsWyDkXHbuXK.tqsimYZualqvSGpXtY83mid4n/.S', 'Pham Lead Developer', 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;

-- Tạo 1 Workspace mẫu của dự án LivingDocs
INSERT INTO workspaces (workspace_id, name, slug, owner_id) VALUES
(1, 'LivingDocs Core Workspace', 'livingdocs-core', 1)
ON CONFLICT (slug) DO NOTHING;

-- Gán 5 tài khoản vào Workspace mẫu tương ứng 5 vai trò
INSERT INTO workspace_members (workspace_id, user_id, role_id) VALUES
(1, 1, 1), -- Admin
(1, 2, 2), -- Tech Lead
(1, 3, 3), -- Manager
(1, 4, 4), -- Staff
(1, 5, 5)  -- Developer
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Thiết lập lại sequence cho các bảng có ID tự tăng
SELECT setval('roles_role_id_seq', (SELECT MAX(role_id) FROM roles));
SELECT setval('users_user_id_seq', (SELECT MAX(user_id) FROM users));
SELECT setval('workspaces_workspace_id_seq', (SELECT MAX(workspace_id) FROM workspaces));
