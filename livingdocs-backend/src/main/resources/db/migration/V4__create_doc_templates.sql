-- ==============================================================================
-- LivingDocs - V4__create_doc_templates.sql
-- Flyway: bảng doc_templates và 5 mẫu cấu trúc tài liệu chuẩn
-- ==============================================================================

CREATE TABLE IF NOT EXISTS doc_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    structure_json JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_doc_templates_type UNIQUE (type)
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_is_default ON doc_templates (is_default);

INSERT INTO doc_templates (name, type, structure_json, is_default)
VALUES
(
    'API Reference',
    'API_REFERENCE',
    '{
      "sections": [
        {"key": "overview", "title": "Tổng quan", "required": true, "hint": "API này làm gì và ai gọi nó."},
        {"key": "authentication", "title": "Xác thực", "required": true, "hint": "Cách gửi token hoặc khóa."},
        {"key": "endpoints", "title": "Danh sách endpoint", "required": true, "hint": "Method, đường dẫn và mục đích."},
        {"key": "parameters", "title": "Tham số", "required": true, "hint": "Path, query và body."},
        {"key": "responses", "title": "Phản hồi", "required": true, "hint": "Mã trạng thái và dạng dữ liệu trả về."},
        {"key": "errors", "title": "Lỗi thường gặp", "required": false, "hint": "Mã lỗi và cách xử lý."},
        {"key": "examples", "title": "Ví dụ", "required": true, "hint": "Một request và response thật."}
      ]
    }'::jsonb,
    TRUE
),
(
    'Module Guide',
    'MODULE_GUIDE',
    '{
      "sections": [
        {"key": "purpose", "title": "Mục đích", "required": true, "hint": "Module giải quyết việc gì."},
        {"key": "installation", "title": "Cài đặt", "required": true, "hint": "Phụ thuộc và lệnh cài."},
        {"key": "public_api", "title": "API công khai", "required": true, "hint": "Hàm hoặc lớp bên ngoài được phép gọi."},
        {"key": "usage", "title": "Cách dùng", "required": true, "hint": "Luồng sử dụng chính."},
        {"key": "configuration", "title": "Cấu hình", "required": false, "hint": "Biến môi trường và giá trị mặc định."},
        {"key": "troubleshooting", "title": "Xử lý sự cố", "required": false, "hint": "Lỗi hay gặp và cách sửa."}
      ]
    }'::jsonb,
    TRUE
),
(
    'ADR',
    'ADR',
    '{
      "sections": [
        {"key": "status", "title": "Trạng thái", "required": true, "hint": "Đề xuất, đã chấp nhận hoặc đã thay thế."},
        {"key": "context", "title": "Bối cảnh", "required": true, "hint": "Vấn đề cần quyết định."},
        {"key": "decision", "title": "Quyết định", "required": true, "hint": "Phương án được chọn."},
        {"key": "alternatives", "title": "Phương án khác", "required": true, "hint": "Những cách đã cân nhắc rồi bỏ."},
        {"key": "consequences", "title": "Hệ quả", "required": true, "hint": "Việc được và việc phải chịu."}
      ]
    }'::jsonb,
    TRUE
),
(
    'Onboarding Guide',
    'ONBOARDING_GUIDE',
    '{
      "sections": [
        {"key": "prerequisites", "title": "Điều kiện trước", "required": true, "hint": "Công cụ và quyền cần có."},
        {"key": "local_setup", "title": "Chạy máy local", "required": true, "hint": "Các lệnh từ clone đến khi mở được app."},
        {"key": "first_task", "title": "Việc đầu tiên", "required": true, "hint": "Một thay đổi nhỏ để làm quen."},
        {"key": "conventions", "title": "Quy ước nhóm", "required": true, "hint": "Nhánh, commit và cách review."},
        {"key": "help", "title": "Hỏi ai", "required": false, "hint": "Kênh liên lạc khi bị kẹt."}
      ]
    }'::jsonb,
    TRUE
),
(
    'README',
    'README',
    '{
      "sections": [
        {"key": "summary", "title": "Dự án là gì", "required": true, "hint": "Một đoạn mô tả sản phẩm."},
        {"key": "quick_start", "title": "Chạy nhanh", "required": true, "hint": "Lệnh ngắn nhất để mở dự án."},
        {"key": "structure", "title": "Cấu trúc thư mục", "required": true, "hint": "Thư mục chính và vai trò của chúng."},
        {"key": "scripts", "title": "Lệnh thường dùng", "required": false, "hint": "Test, lint và chạy local."},
        {"key": "contributing", "title": "Đóng góp", "required": false, "hint": "Cách gửi thay đổi cho nhóm."}
      ]
    }'::jsonb,
    TRUE
)
ON CONFLICT (type) DO NOTHING;
