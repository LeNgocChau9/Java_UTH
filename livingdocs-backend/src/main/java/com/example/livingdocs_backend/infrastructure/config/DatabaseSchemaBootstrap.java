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

            // Bảng code_entities phục vụ lưu trữ các thực thể mã nguồn bóc tách AST thực tế từ repository
            try {
                Integer countRepo7 = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM code_entities WHERE repository_id = 7", Integer.class);
                if (countRepo7 == null || countRepo7 == 0) {
                    jdbcTemplate.execute("""
                        INSERT INTO code_entities (repository_id, file_path, entity_type, class_name, method_name, signature, return_type, parameters, start_line, end_line, commit_hash, doc_status)
                        VALUES 
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientListener.cs', 'CLASS', 'ClientListener', NULL, 'public class ClientListener', NULL, NULL, 12, 110, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientListener.cs', 'METHOD', 'ClientListener', 'StartListening', 'public void StartListening()', 'void', NULL, 25, 48, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientListener.cs', 'METHOD', 'ClientListener', 'ProcessIncomingMessage', 'public void ProcessIncomingMessage(byte[] buffer, int bytesRead)', 'void', 'byte[] buffer, int bytesRead', 52, 85, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientListener.cs', 'METHOD', 'ClientListener', 'CloseConnection', 'public void CloseConnection()', 'void', NULL, 90, 108, 'abce396', 'DOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientSocket.cs', 'CLASS', 'ClientSocket', NULL, 'public class ClientSocket', NULL, NULL, 10, 95, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientSocket.cs', 'METHOD', 'ClientSocket', 'Connect', 'public bool Connect(string serverIp, int port)', 'bool', 'string serverIp, int port', 20, 42, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientSocket.cs', 'METHOD', 'ClientSocket', 'SendMove', 'public void SendMove(int row, int col, string playerSymbol)', 'void', 'int row, int col, string playerSymbol', 46, 68, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/Network/ClientSocket.cs', 'METHOD', 'ClientSocket', 'Disconnect', 'public void Disconnect()', 'void', NULL, 72, 92, 'abce396', 'DOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Client/MainForm.cs', 'CLASS', 'MainForm', NULL, 'public partial class MainForm : Form', NULL, NULL, 18, 240, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/MainForm.cs', 'METHOD', 'MainForm', 'InitializeBoard', 'private void InitializeBoard()', 'void', NULL, 30, 65, 'abce396', 'DOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/MainForm.cs', 'METHOD', 'MainForm', 'HandleCellClick', 'private void HandleCellClick(int row, int col)', 'void', 'int row, int col', 70, 115, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/MainForm.cs', 'METHOD', 'MainForm', 'UpdateTimer', 'private void UpdateTimer(int secondsLeft)', 'void', 'int secondsLeft', 120, 145, 'abce396', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Client/MainForm.cs', 'METHOD', 'MainForm', 'ShowWinnerDialog', 'private void ShowWinnerDialog(string winner)', 'void', 'string winner', 150, 180, 'abce396', 'UNDOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Network/ServerSocket.cs', 'CLASS', 'ServerSocket', NULL, 'public class ServerSocket', NULL, NULL, 15, 130, 'a9838a1', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Network/ServerSocket.cs', 'METHOD', 'ServerSocket', 'StartServer', 'public void StartServer(int port)', 'void', 'int port', 28, 55, 'a9838a1', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Network/ServerSocket.cs', 'METHOD', 'ServerSocket', 'AcceptClients', 'public async Task AcceptClients()', 'Task', NULL, 60, 95, 'a9838a1', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Network/ServerSocket.cs', 'METHOD', 'ServerSocket', 'BroadcastMove', 'public void BroadcastMove(int roomId, int row, int col)', 'void', 'int roomId, int row, int col', 100, 125, 'a9838a1', 'UNDOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Game/GameManager.cs', 'CLASS', 'GameManager', NULL, 'public class GameManager', NULL, NULL, 12, 160, 'a9838a1', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Game/GameManager.cs', 'METHOD', 'GameManager', 'CreateRoom', 'public Room CreateRoom(string hostPlayerId)', 'Room', 'string hostPlayerId', 25, 45, 'a9838a1', 'DOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Game/GameManager.cs', 'METHOD', 'GameManager', 'JoinRoom', 'public bool JoinRoom(string roomId, string guestPlayerId)', 'bool', 'string roomId, string guestPlayerId', 50, 75, 'a9838a1', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Game/GameManager.cs', 'METHOD', 'GameManager', 'ValidateMove', 'public bool ValidateMove(int roomId, int row, int col)', 'bool', 'int roomId, int row, int col', 80, 110, 'a9838a1', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Server/Game/GameManager.cs', 'METHOD', 'GameManager', 'CheckWinCondition', 'public bool CheckWinCondition(int[,] board, int lastRow, int lastCol)', 'bool', 'int[,] board, int lastRow, int lastCol', 115, 155, 'a9838a1', 'UNDOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Interfaces/IGameEngine.cs', 'INTERFACE', 'IGameEngine', NULL, 'public interface IGameEngine', NULL, NULL, 8, 30, 'dd75419', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Interfaces/IGameEngine.cs', 'METHOD', 'IGameEngine', 'ProcessTurn', 'bool ProcessTurn(Player player, Point move)', 'bool', 'Player player, Point move', 15, 20, 'dd75419', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Interfaces/IGameEngine.cs', 'METHOD', 'IGameEngine', 'IsGameOver', 'bool IsGameOver()', 'bool', NULL, 22, 28, 'dd75419', 'UNDOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Interfaces/INetworkTransport.cs', 'INTERFACE', 'INetworkTransport', NULL, 'public interface INetworkTransport', NULL, NULL, 6, 25, 'dd75419', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Interfaces/INetworkTransport.cs', 'METHOD', 'INetworkTransport', 'SendPacketAsync', 'Task SendPacketAsync(byte[] payload)', 'Task', 'byte[] payload', 12, 18, 'dd75419', 'UNDOCUMENTED'),

                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Models/Board.cs', 'CLASS', 'Board', NULL, 'public class Board', NULL, NULL, 10, 80, 'dd75419', 'UNDOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Models/Board.cs', 'METHOD', 'Board', 'IsCellEmpty', 'public bool IsCellEmpty(int x, int y)', 'bool', 'int x, int y', 25, 38, 'dd75419', 'DOCUMENTED'),
                        (7, 'Code/NetworkCaroGame/src/Caro.Core/Models/Board.cs', 'METHOD', 'Board', 'PlaceMark', 'public bool PlaceMark(int x, int y, string symbol)', 'bool', 'int x, int y, string symbol', 42, 65, 'dd75419', 'UNDOCUMENTED')
                    """);
                    log.info("[DatabaseSchemaBootstrap] Đã nạp code_entities thực tế cho Repository 7 (C-Caro-C-).");
                }
            } catch (Exception ex) {
                log.debug("[DatabaseSchemaBootstrap] Bỏ qua seed code_entities cho Repo 7: {}", ex.getMessage());
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
