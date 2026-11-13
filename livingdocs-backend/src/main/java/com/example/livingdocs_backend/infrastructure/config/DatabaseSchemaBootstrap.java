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

            // Khởi tạo các phần tử mã nguồn mẫu (code_entities) cho Repository 1 nếu chưa có
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

            Integer entityCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM code_entities WHERE repository_id = 1", Integer.class);
            if (entityCount == null || entityCount == 0) {
                jdbcTemplate.execute(
                        """
                                    INSERT INTO code_entities (repository_id, file_path, entity_type, class_name, method_name, signature, return_type, parameters, start_line, end_line, commit_hash, doc_status)
                                    VALUES
                                      (1, 'src/main/java/com/example/demo/controller/OrderController.java', 'CLASS', 'OrderController', NULL, 'public class OrderController', NULL, NULL, 15, 120, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/controller/OrderController.java', 'METHOD', 'OrderController', 'createOrder', 'public ResponseEntity<OrderDto> createOrder(@RequestBody CreateOrderRequest request)', 'ResponseEntity<OrderDto>', 'CreateOrderRequest request', 35, 55, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/controller/OrderController.java', 'METHOD', 'OrderController', 'getOrderById', 'public ResponseEntity<OrderDto> getOrderById(@PathVariable Long orderId)', 'ResponseEntity<OrderDto>', 'Long orderId', 60, 75, 'c8914b1', 'DOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/service/PaymentGateway.java', 'INTERFACE', 'PaymentGateway', NULL, 'public interface PaymentGateway', NULL, NULL, 10, 45, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/service/PaymentGateway.java', 'METHOD', 'PaymentGateway', 'processPayment', 'boolean processPayment(PaymentRequest payment, BigDecimal amount)', 'boolean', 'PaymentRequest payment, BigDecimal amount', 22, 28, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/service/PaymentGateway.java', 'METHOD', 'PaymentGateway', 'refundPayment', 'RefundResult refundPayment(String transactionId, String reason)', 'RefundResult', 'String transactionId, String reason', 30, 36, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/service/UserService.java', 'CLASS', 'UserService', NULL, 'public class UserService implements UserDetailsService', NULL, NULL, 20, 160, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/service/UserService.java', 'METHOD', 'UserService', 'authenticateUser', 'public AuthResponse authenticateUser(LoginRequest request)', 'AuthResponse', 'LoginRequest request', 45, 80, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/service/UserService.java', 'METHOD', 'UserService', 'updateUserProfile', 'public UserDto updateUserProfile(Long userId, UpdateProfileRequest request)', 'UserDto', 'Long userId, UpdateProfileRequest request', 85, 115, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/repository/NotificationRepository.java', 'INTERFACE', 'NotificationRepository', NULL, 'public interface NotificationRepository extends JpaRepository<Notification, Long>', NULL, NULL, 12, 35, 'c8914b1', 'UNDOCUMENTED'),
                                      (1, 'src/main/java/com/example/demo/repository/NotificationRepository.java', 'METHOD', 'NotificationRepository', 'findByUserIdAndIsReadFalse', 'List<Notification> findByUserIdAndIsReadFalse(Long userId)', 'List<Notification>', 'Long userId', 20, 25, 'c8914b1', 'UNDOCUMENTED')
                                """);
            }
            log.info(
                    "[DatabaseSchemaBootstrap] Đã kiểm tra và đồng bộ doc_templates, document_versions, jobs, code_entities thành công.");
        } catch (Exception ex) {
            log.debug(
                    "[DatabaseSchemaBootstrap] Bỏ qua đồng bộ schema tự động (có thể đang chạy môi trường H2/Test): {}",
                    ex.getMessage());
        }
    }
}
