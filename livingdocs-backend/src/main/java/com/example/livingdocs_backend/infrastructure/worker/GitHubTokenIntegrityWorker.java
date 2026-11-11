package com.example.livingdocs_backend.infrastructure.worker;

import com.example.livingdocs_backend.application.dto.github.GitHubConnectionStatusResponse;
import com.example.livingdocs_backend.application.port.RepositoryServicePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Worker chạy ngầm định kỳ kiểm tra tính hợp lệ và toàn vẹn của Token GitHub
 * (Personal Access Token / GitHub OAuth App Token) của các tài khoản và kho lưu trữ đã kết nối.
 *
 * Khi phát hiện token bị người dùng thu hồi (Revoked) trên GitHub hoặc hết hạn (Expired):
 * - Tự động cập nhật trạng thái trong database (status = EXPIRED hoặc REVOKED).
 * - Bắn thông báo cảnh báo bảo mật qua AuditLog và hỗ trợ Frontend hiển thị cảnh báo đỏ đi kèm nút cấp lại quyền.
 * - Đảm bảo hệ thống không bị crash hoặc gián đoạn hoạt động của các tiến trình khác.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitHubTokenIntegrityWorker {

    private final RepositoryServicePort repositoryServicePort;

    @Value("${github.token.integrity-check.enabled:true}")
    private boolean enabled;

    /**
     * Mặc định quét định kỳ mỗi 5 phút (300,000 ms), với độ trễ ban đầu 30 giây sau khi ứng dụng khởi động.
     * Có thể tinh chỉnh qua cấu hình: github.token.integrity-check.fixed-rate
     */
    @Scheduled(
            fixedRateString = "${github.token.integrity-check.fixed-rate:300000}",
            initialDelayString = "${github.token.integrity-check.initial-delay:30000}"
    )
    public void scanAndVerifyGitHubTokens() {
        if (!enabled) {
            log.debug("[GitHubTokenIntegrityWorker] Tính năng quét định kỳ tính toàn vẹn token đang bị tắt.");
            return;
        }

        log.info("[GitHubTokenIntegrityWorker] Bắt đầu tiến trình định kỳ kiểm tra tính toàn vẹn của GitHub Access Tokens...");
        try {
            // Kiểm tra toàn bộ kết nối GitHub đang lưu trong cơ sở dữ liệu
            List<GitHubConnectionStatusResponse> statuses = repositoryServicePort.verifyWorkspaceConnections(null, null);

            long revokedCount = statuses.stream().filter(s -> "REVOKED".equalsIgnoreCase(s.getStatus())).count();
            long expiredCount = statuses.stream().filter(s -> "EXPIRED".equalsIgnoreCase(s.getStatus())).count();
            long validCount = statuses.stream().filter(GitHubConnectionStatusResponse::isValid).count();

            log.info("[GitHubTokenIntegrityWorker] Hoàn tất quét toàn vẹn token: Tổng số={}, Hợp lệ={}, Thu hồi (Revoked)={}, Hết hạn (Expired)={}",
                    statuses.size(), validCount, revokedCount, expiredCount);

            if (revokedCount > 0 || expiredCount > 0) {
                log.warn("[GitHubTokenIntegrityWorker] CẢNH BÁO: Phát hiện {} token không còn khả dụng ({} revoked, {} expired). Giao diện kho lưu trữ sẽ hiển thị cảnh báo yêu cầu cấp quyền lại.",
                        revokedCount + expiredCount, revokedCount, expiredCount);
            }
        } catch (Exception ex) {
            log.error("[GitHubTokenIntegrityWorker] Xảy ra sự cố khi quét kiểm tra token GitHub: {}. Hệ thống vẫn duy trì hoạt động bình thường.",
                    ex.getMessage(), ex);
        }
    }
}

