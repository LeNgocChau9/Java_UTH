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

            jdbcTemplate.execute("""
                INSERT INTO doc_templates (id, name, type, structure_json, is_default)
                VALUES
                  (1, 'API Reference', 'API_REFERENCE', '{}'::jsonb, true),
                  (2, 'Project README', 'PROJECT_README', '{}'::jsonb, false),
                  (3, 'Module Guide', 'MODULE_GUIDE', '{}'::jsonb, false),
                  (4, 'Architecture ADR', 'ARCHITECTURE_ADR', '{}'::jsonb, false)
                ON CONFLICT (id) DO NOTHING
            """);
            log.info("[DatabaseSchemaBootstrap] Đã kiểm tra và đồng bộ doc_templates + document_versions thành công.");
        } catch (Exception ex) {
            log.debug("[DatabaseSchemaBootstrap] Bỏ qua đồng bộ schema tự động (có thể đang chạy môi trường H2/Test): {}", ex.getMessage());
        }
    }
}
