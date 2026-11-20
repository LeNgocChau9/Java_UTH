package com.example.livingdocs_backend.infrastructure.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class DatabaseSchemaBootstrap implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_id BIGINT");
            jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'MANUAL'");
            jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_url VARCHAR(1024)");
            jdbcTemplate.execute("ALTER TABLE doc_collections ADD COLUMN IF NOT EXISTS module_tag VARCHAR(150)");
            jdbcTemplate.execute("ALTER TABLE doc_collections ADD COLUMN IF NOT EXISTS owner_id BIGINT");
            jdbcTemplate.execute("ALTER TABLE doc_collections ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150)");
            jdbcTemplate.execute("ALTER TABLE doc_collections ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255)");
            jdbcTemplate.execute("ALTER TABLE doc_collections ADD COLUMN IF NOT EXISTS owner_role VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS commit_hash VARCHAR(256)");
            jdbcTemplate.execute("ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS commit_url VARCHAR(1024)");
            jdbcTemplate.execute("ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP");

            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS result_json TEXT");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payload_json TEXT NOT NULL DEFAULT '{}'");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_error TEXT");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE");

            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_notification_preferences (
                    user_id BIGINT PRIMARY KEY,
                    email_enabled BOOLEAN NOT NULL DEFAULT true,
                    github_enabled BOOLEAN NOT NULL DEFAULT true,
                    review_enabled BOOLEAN NOT NULL DEFAULT true,
                    document_enabled BOOLEAN NOT NULL DEFAULT true,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """);

            // R4: Review comments persistence enhancements
            try {
                jdbcTemplate.execute("ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS doc_id BIGINT");
                jdbcTemplate.execute("ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'OPEN'");
                jdbcTemplate.execute("ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS author_email VARCHAR(100)");
                jdbcTemplate.execute("ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS author_role VARCHAR(50)");
                jdbcTemplate.execute("ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP");
                try {
                    jdbcTemplate.execute("ALTER TABLE review_comments ALTER COLUMN review_id DROP NOT NULL");
                } catch (Exception ignore) {}
                try {
                    jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_review_comments_doc_id ON review_comments(doc_id)");
                    jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_review_comments_status ON review_comments(status)");
                } catch (Exception ignore) {}
            } catch (Exception e) {
                log.debug("[DatabaseSchemaBootstrap] review_comments DDL update skipped/failed: {}", e.getMessage());
            }

            // R6: Relational manager approval policies & delegations
            try {
                jdbcTemplate.execute("""
                    CREATE TABLE IF NOT EXISTS manager_approval_policies (
                        policy_id BIGSERIAL PRIMARY KEY,
                        workspace_id BIGINT NOT NULL DEFAULT 1,
                        document_type VARCHAR(100) NOT NULL,
                        approval_required BOOLEAN NOT NULL DEFAULT true,
                        merge_policy VARCHAR(20) NOT NULL DEFAULT 'WARN',
                        tiers INTEGER NOT NULL DEFAULT 2,
                        description TEXT,
                        updated_by BIGINT,
                        updated_by_email VARCHAR(255),
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uk_manager_policy_workspace_type UNIQUE (workspace_id, document_type)
                    )
                """);
                jdbcTemplate.execute("ALTER TABLE manager_approval_policies ADD COLUMN IF NOT EXISTS tiers INTEGER DEFAULT 2");
                jdbcTemplate.execute("ALTER TABLE manager_approval_policies ADD COLUMN IF NOT EXISTS description TEXT");
                jdbcTemplate.execute("ALTER TABLE manager_approval_policies ADD COLUMN IF NOT EXISTS updated_by_email VARCHAR(255)");

                jdbcTemplate.execute("""
                    CREATE TABLE IF NOT EXISTS manager_approval_delegations (
                        delegation_id BIGSERIAL PRIMARY KEY,
                        workspace_id BIGINT NOT NULL DEFAULT 1,
                        delegator_id BIGINT NOT NULL,
                        delegate_id BIGINT NOT NULL,
                        delegator_name VARCHAR(150),
                        delegator_email VARCHAR(255),
                        delegatee_name VARCHAR(150),
                        delegatee_email VARCHAR(255),
                        active BOOLEAN NOT NULL DEFAULT true,
                        starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ends_at TIMESTAMP WITH TIME ZONE,
                        reason TEXT,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                """);
                jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ADD COLUMN IF NOT EXISTS delegator_name VARCHAR(150)");
                jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ADD COLUMN IF NOT EXISTS delegatee_name VARCHAR(150)");
                jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ADD COLUMN IF NOT EXISTS delegator_email VARCHAR(255)");
                jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ADD COLUMN IF NOT EXISTS delegatee_email VARCHAR(255)");
                jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true");
                try {
                    jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ALTER COLUMN delegator_id DROP NOT NULL");
                    jdbcTemplate.execute("ALTER TABLE manager_approval_delegations ALTER COLUMN delegate_id DROP NOT NULL");
                } catch (Exception ignore) {}
            } catch (Exception e) {
                log.debug("[DatabaseSchemaBootstrap] manager_approval DDL update skipped/failed: {}", e.getMessage());
            }

            // Tự động seed 5 vai trò chuẩn (ADMIN, TECH_LEAD, MANAGER, STAFF, DEVELOPER) và default workspace (workspace_id = 1)
            // để không bao giờ lỗi khi đổi role sang STAFF hoặc gán thành viên trên DB mới
            try {
                jdbcTemplate.execute("""
                    INSERT INTO roles (role_id, role_name, description)
                    VALUES
                        (1, 'ADMIN', 'Quản trị viên toàn hệ thống'),
                        (2, 'TECH_LEAD', 'Trưởng nhóm kỹ thuật'),
                        (3, 'MANAGER', 'Quản lý phê duyệt xuất bản (Cấp 2)'),
                        (4, 'STAFF', 'Nhân viên thẩm định tài liệu (Cấp 1)'),
                        (5, 'DEVELOPER', 'Lập trình viên biên soạn tài liệu')
                    ON CONFLICT (role_name) DO UPDATE SET
                        description = EXCLUDED.description
                """);

                // Đảm bảo có ít nhất 1 user để làm owner cho workspace mặc định nếu bảng users hoàn toàn trống
                jdbcTemplate.execute("""
                    INSERT INTO users (user_id, email, password_hash, full_name, status)
                    SELECT 1, 'system@livingdocs.internal', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi7BfG9O6d/2.N9x7BfG9O6d/2.N9x7', 'LivingDocs System Admin', 'ACTIVE'
                    WHERE NOT EXISTS (SELECT 1 FROM users)
                    ON CONFLICT DO NOTHING
                """);

                jdbcTemplate.execute("""
                    INSERT INTO workspaces (workspace_id, name, slug, owner_id)
                    SELECT 1, 'LivingDocs Core Workspace', 'livingdocs-core',
                           COALESCE((SELECT MIN(user_id) FROM users), 1)
                    WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE workspace_id = 1)
                    ON CONFLICT (workspace_id) DO NOTHING
                """);
                log.info("[DatabaseSchemaBootstrap] Đã kiểm tra và tự động seed roles (DEVELOPER, STAFF, MANAGER, TECH_LEAD, ADMIN) và default workspace thành công.");
            } catch (Exception seedEx) {
                log.debug("[DatabaseSchemaBootstrap] Bỏ qua seed roles/workspaces: {}", seedEx.getMessage());
            }

            jdbcTemplate.execute("""
                INSERT INTO doc_templates (id, name, type, structure_json, is_default)
                VALUES
                  (1, 'API Reference', 'API_REFERENCE', '{}'::jsonb, false),
                  (2, 'Project README', 'PROJECT_README', '{}'::jsonb, false),
                  (3, 'Module Guide', 'MODULE_GUIDE', '{}'::jsonb, false),
                  (4, 'Architecture ADR', 'ARCHITECTURE_ADR', '{}'::jsonb, false),
                  (6, 'Tài liệu Dự án Tiêu chuẩn (10 Phần)', 'PROJECT_DOCUMENTATION', '{"sections": [
                    {"key": "cover_history_toc", "title": "Phần đầu tài liệu", "hint": "Trang bìa, Lịch sử chỉnh sửa tài liệu và Mục lục.", "required": true},
                    {"key": "introduction", "title": "Giới thiệu", "hint": "Mục đích, đối tượng sử dụng, phạm vi, thuật ngữ viết tắt và tài liệu tham khảo.", "required": true},
                    {"key": "system_requirements", "title": "Yêu cầu hệ thống", "hint": "Phần cứng (CPU, RAM, ổ đĩa), hệ điều hành/trình duyệt và kết nối mạng.", "required": true},
                    {"key": "installation_config", "title": "Cài đặt và cấu hình", "hint": "Tải về và cài đặt từng bước, cấu hình ban đầu, cập nhật/gỡ cài đặt.", "required": true},
                    {"key": "getting_started", "title": "Bắt đầu sử dụng", "hint": "Đăng nhập/đăng xuất, giao diện chính, phân quyền và quick start.", "required": true},
                    {"key": "features_guide", "title": "Hướng dẫn chi tiết từng chức năng", "hint": "Mục đích, điều kiện cần, các bước thực hiện, kết quả mong đợi từng chức năng.", "required": true},
                    {"key": "troubleshooting", "title": "Xử lý sự cố", "hint": "Bảng mã lỗi và thông báo lỗi, nguyên nhân, cách khắc phục, FAQ.", "required": true},
                    {"key": "security_backup", "title": "Bảo mật và sao lưu", "hint": "Bảo mật tài khoản, dữ liệu, sao lưu và phục hồi dữ liệu.", "required": true},
                    {"key": "support", "title": "Hỗ trợ", "hint": "Thông tin liên hệ hỗ trợ, cách báo lỗi và gửi phản hồi.", "required": true},
                    {"key": "appendix", "title": "Phụ lục", "hint": "Danh sách phím tắt, bảng thuật ngữ, giấy phép bản quyền, mẫu biểu.", "required": false}
                  ]}'::jsonb, true)
                ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name,
                  structure_json = EXCLUDED.structure_json,
                  is_default = EXCLUDED.is_default
            """);
            log.info("[DatabaseSchemaBootstrap] Đã kiểm tra và đồng bộ doc_templates, document_versions, jobs thành công.");

            // ponytail: Dọn dẹp mock drift alerts và mock code_entities giả lập nếu có, tuyệt đối không tự động seed dữ liệu giả
            try {
                jdbcTemplate.execute("DELETE FROM document_change_alerts WHERE source_commit = '7f8a9bc' AND source_pr_id = 12");
                jdbcTemplate.execute("DELETE FROM code_entities WHERE repository_id = 7 AND commit_hash IN ('abce396', 'a9838a1', 'dd75419')");
                log.info("[DatabaseSchemaBootstrap] Đã kiểm tra và dọn dẹp mock drift alerts & mock code_entities nếu tồn tại.");
            } catch (Exception ex) {
                log.debug("[DatabaseSchemaBootstrap] Bỏ qua dọn dẹp mock data: {}", ex.getMessage());
            }

            // Khởi tạo bảng code_entities nếu chưa có
            jdbcTemplate.execute("""
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
                            imports TEXT,
                            extends_class VARCHAR(255),
                            implements_interfaces TEXT,
                            call_targets TEXT,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                    """);

            try {
                jdbcTemplate.execute("ALTER TABLE code_entities ADD COLUMN IF NOT EXISTS imports TEXT");
                jdbcTemplate.execute("ALTER TABLE code_entities ADD COLUMN IF NOT EXISTS extends_class VARCHAR(255)");
                jdbcTemplate.execute("ALTER TABLE code_entities ADD COLUMN IF NOT EXISTS implements_interfaces TEXT");
                jdbcTemplate.execute("ALTER TABLE code_entities ADD COLUMN IF NOT EXISTS call_targets TEXT");
            } catch (Exception ex) {
                log.debug("[DatabaseSchemaBootstrap] code_entities columns update skipped/failed: {}", ex.getMessage());
            }

            // ponytail: Khởi tạo extension vector, bảng knowledge_chunks và HNSW index an toàn
            try {
                jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
                jdbcTemplate.execute("""
                    CREATE TABLE IF NOT EXISTS knowledge_chunks (
                        chunk_id BIGSERIAL PRIMARY KEY,
                        repository_id BIGINT,
                        document_id BIGINT,
                        source_path VARCHAR(500) NOT NULL,
                        content TEXT NOT NULL,
                        commit_hash VARCHAR(64),
                        embedding vector(768),
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                """);
                jdbcTemplate.execute("""
                    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
                    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
                """);
                jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_repository ON knowledge_chunks(repository_id)");
                jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id)");
                log.info("[DatabaseSchemaBootstrap] Đã kiểm tra và đồng bộ bảng knowledge_chunks và HNSW index.");
            } catch (Exception ex) {
                log.debug("[DatabaseSchemaBootstrap] Bỏ qua khởi tạo pgvector / knowledge_chunks (có thể database không hỗ trợ pgvector): {}", ex.getMessage());
            }

            log.info(
                    "[DatabaseSchemaBootstrap] Đã kiểm tra và đồng bộ doc_templates, document_versions, jobs, code_entities, knowledge_chunks thành công.");
        } catch (Exception ex) {
            log.debug(
                    "[DatabaseSchemaBootstrap] Bỏ qua đồng bộ schema tự động (có thể đang chạy môi trường H2/Test): {}",
                    ex.getMessage());
        }
    }
}
