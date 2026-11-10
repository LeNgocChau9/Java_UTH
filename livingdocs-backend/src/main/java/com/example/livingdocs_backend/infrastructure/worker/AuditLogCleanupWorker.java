package com.example.livingdocs_backend.infrastructure.worker;

import com.example.livingdocs_backend.application.dto.AuditRetentionConfigDto;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Worker chạy ngầm định kỳ tự động quét và dọn dẹp các bản ghi nhật ký kiểm toán (audit_logs)
 * và lịch sử thay đổi (changelogs) đã quá hạn theo chính sách lưu trữ (retention policy).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogCleanupWorker {

    private final AuditServicePort auditServicePort;

    /**
     * Chạy định kỳ vào 02:00 sáng mỗi ngày (hoặc cấu hình qua cron).
     */
    @Scheduled(cron = "${audit.cleanup.cron:0 0 2 * * ?}")
    public void runScheduledCleanup() {
        try {
            AuditRetentionConfigDto config = auditServicePort.getRetentionConfig();
            if (config != null && Boolean.FALSE.equals(config.getAutoCleanupEnabled())) {
                log.info("[AuditLogCleanupWorker] Tính năng tự động dọn dẹp đang bị tắt trong cài đặt hệ thống. Bỏ qua lần quét này.");
                return;
            }

            log.info("[AuditLogCleanupWorker] Bắt đầu tiến trình tự động dọn dẹp nhật ký kiểm toán định kỳ...");
            auditServicePort.cleanupExpiredLogs(null, null, "AUTO_SCHEDULED");
            log.info("[AuditLogCleanupWorker] Hoàn tất tiến trình tự động dọn dẹp định kỳ.");
        } catch (Exception e) {
            log.error("[AuditLogCleanupWorker] Lỗi khi thực hiện dọn dẹp nhật ký định kỳ: {}", e.getMessage(), e);
        }
    }
}
