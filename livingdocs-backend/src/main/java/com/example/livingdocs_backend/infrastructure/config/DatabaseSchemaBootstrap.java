package com.example.livingdocs_backend.infrastructure.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseSchemaBootstrap implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
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
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                    """);

            log.info(
                    "[DatabaseSchemaBootstrap] Đã kiểm tra và đồng bộ doc_templates, document_versions, jobs, code_entities thành công.");
        } catch (Exception ex) {
            log.debug(
                    "[DatabaseSchemaBootstrap] Bỏ qua đồng bộ schema tự động (có thể đang chạy môi trường H2/Test): {}",
                    ex.getMessage());
        }
    }
}
