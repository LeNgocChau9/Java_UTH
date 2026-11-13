package com.example.livingdocs_backend.infrastructure.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tự động đồng bộ schema bảng document_versions và khởi tạo 4 mẫu tài liệu chuẩn (doc_templates)
 * khi ứng dụng khởi chạy để mọi thành viên trong nhóm đều có thể test sinh tài liệu AI ngay lập tức.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseSchemaBootstrap implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS commit_hash VARCHAR(256)");
            jdbcTemplate.execute("ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS commit_url VARCHAR(1024)");
            jdbcTemplate.execute("ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP");

            // Tự động bổ sung các cột còn thiếu trong bảng jobs nếu DB đã tạo từ phiên bản cũ
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS result_json TEXT");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payload_json TEXT NOT NULL DEFAULT '{}'");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_error TEXT");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE");
            jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE");

            jdbcTemplate.execute("""
                INSERT INTO doc_templates (id, name, type, structure_json, is_default)
                VALUES
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

            // Tự động seed cảnh báo sai lệch mẫu (nếu bảng rỗng) để chuông thông báo hiển thị badge đỏ số trắng trực quan
            try {
                Integer alertCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM document_change_alerts", Integer.class);
                if (alertCount != null && alertCount == 0) {
                    jdbcTemplate.execute("""
                        INSERT INTO document_change_alerts (document_id, repository_id, classification, severity, status, source_commit, source_pr_id, details)
                        SELECT d.doc_id, d.repo_id, 'SEMANTIC', 'HIGH', 'OPEN', '7f8a9bc', 12, 'Phát hiện thay đổi phương thức authenticate() trong commit 7f8a9bc làm sai lệch tài liệu kiến trúc.'
                        FROM documents d
                        ORDER BY d.doc_id DESC
                        LIMIT 1
                    """);
                    log.info("[DatabaseSchemaBootstrap] Đã khởi tạo cảnh báo sai lệch mẫu cho chuông thông báo.");
                }
            } catch (Exception ex) {
                log.debug("[DatabaseSchemaBootstrap] Bỏ qua seed cảnh báo mẫu: {}", ex.getMessage());
            }
        } catch (Exception ex) {
            log.debug("[DatabaseSchemaBootstrap] Bỏ qua đồng bộ schema tự động (có thể đang chạy môi trường H2/Test): {}", ex.getMessage());
        }
    }
}
