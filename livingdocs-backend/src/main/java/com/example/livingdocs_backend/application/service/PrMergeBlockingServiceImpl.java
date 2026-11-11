package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.drift.PrMergeBlockingPolicyDto;
import com.example.livingdocs_backend.application.dto.github.GitHubCheckRunResultDto;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.*;

/**
 * Service thực thi cơ chế Chặn Hợp nhất Pull Request khi tài liệu bị sai lệch nghiêm trọng (Task tuần 6 - Issue #208).
 * - Kết nối GitHub Checks API / Statuses API.
 * - Cho phép Quản lý cấu hình chế độ Chặn cứng (STRICT) hoặc Cảnh báo nhắc nhở (WARN_ONLY).
 * - Tự động đổi trạng thái sang màu xanh (Success) khi tài liệu được phê duyệt cập nhật.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PrMergeBlockingServiceImpl implements PrMergeBlockingServicePort {

    public static final String PR_BLOCKING_SETTING_KEY = "pr_merge_blocking_policy";

    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final SpringDataPullRequestRepository pullRequestRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final DocumentRepositoryPort documentRepositoryPort;
    private final GitHubClientPort gitHubClient;
    private final ObjectMapper objectMapper;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    @Transactional(readOnly = true)
    public PrMergeBlockingPolicyDto getBlockingPolicy() {
        return adminSettingRepository.findById(PR_BLOCKING_SETTING_KEY)
                .map(entity -> {
                    try {
                        return objectMapper.readValue(entity.getSettingValue(), PrMergeBlockingPolicyDto.class);
                    } catch (Exception e) {
                        log.warn("[PrMergeBlocking] Không thể parse cấu hình từ admin_settings: {}", e.getMessage());
                        return defaultPolicy();
                    }
                })
                .orElseGet(this::defaultPolicy);
    }

    @Override
    @Transactional
    public PrMergeBlockingPolicyDto updateBlockingPolicy(PrMergeBlockingPolicyDto dto, Long actorId, String actorUsername) {
        PrMergeBlockingPolicyDto current = getBlockingPolicy();
        PrMergeBlockingPolicyDto toSave = PrMergeBlockingPolicyDto.builder()
                .enabled(dto.getEnabled() != null ? dto.getEnabled() : current.getEnabled())
                .blockingMode(StringUtils.hasText(dto.getBlockingMode()) ? dto.getBlockingMode().trim().toUpperCase() : current.getBlockingMode())
                .minSeverity(StringUtils.hasText(dto.getMinSeverity()) ? dto.getMinSeverity().trim().toUpperCase() : current.getMinSeverity())
                .checkName(StringUtils.hasText(dto.getCheckName()) ? dto.getCheckName().trim() : current.getCheckName())
                .autoUnlockOnApproval(dto.getAutoUnlockOnApproval() != null ? dto.getAutoUnlockOnApproval() : current.getAutoUnlockOnApproval())
                .updatedAt(Instant.now())
                .updatedBy(StringUtils.hasText(actorUsername) ? actorUsername : (actorId != null ? "User #" + actorId : "ADMIN"))
                .build();

        try {
            String json = objectMapper.writeValueAsString(toSave);
            adminSettingRepository.save(AdminSettingEntity.builder()
                    .settingKey(PR_BLOCKING_SETTING_KEY)
                    .settingValue(json)
                    .updatedBy(actorId)
                    .updatedAt(Instant.now())
                    .build());
            log.info("[PrMergeBlocking] Đã cập nhật chính sách chặn gộp PR: enabled={}, mode={}, minSeverity={}",
                    toSave.getEnabled(), toSave.getBlockingMode(), toSave.getMinSeverity());
            return toSave;
        } catch (Exception e) {
            log.error("[PrMergeBlocking] Lỗi lưu chính sách chặn gộp PR: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu cấu hình chặn hợp nhất PR: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public GitHubCheckRunResultDto evaluateAndSendPrCheck(Long repositoryId, int prNumber, String headSha) {
        PrMergeBlockingPolicyDto policy = getBlockingPolicy();
        if (!Boolean.TRUE.equals(policy.getEnabled())) {
            log.info("[PrMergeBlocking] Tính năng kiểm tra chặn PR đang TẮT. Bỏ qua Check Run cho PR #{}", prNumber);
            return null;
        }

        RepositoryEntity repo = repositoryRepository.findById(repositoryId).orElse(null);
        if (repo == null) {
            log.warn("[PrMergeBlocking] Không tìm thấy repositoryId={}", repositoryId);
            return null;
        }

        // Lấy thông tin PR
        Optional<PullRequestEntity> prOpt = pullRequestRepository.findByRepositoryIdAndPrNumber(repositoryId, prNumber);
        String finalSha = StringUtils.hasText(headSha) ? headSha : prOpt.map(PullRequestEntity::getHeadCommitHash).orElse(null);
        if (!StringUtils.hasText(finalSha)) {
            log.warn("[PrMergeBlocking] PR #{} không có Head Commit SHA hợp lệ để gửi Check", prNumber);
            return null;
        }

        // Tìm các alert còn OPEN thuộc PR này
        Long prId = prOpt.map(PullRequestEntity::getPrId).orElse(null);
        List<DocumentChangeAlertEntity> openAlerts = new ArrayList<>();
        if (prId != null) {
            openAlerts = alertRepository.findBySourcePrId(prId).stream()
                    .filter(a -> "OPEN".equalsIgnoreCase(a.getStatus()))
                    .toList();
        }

        // Nếu alert chưa gắn sourcePrId, tìm theo repoId và headSha
        if (openAlerts.isEmpty()) {
            openAlerts = alertRepository.findByRepositoryIdAndStatus(repositoryId, "OPEN").stream()
                    .filter(a -> finalSha.equalsIgnoreCase(a.getSourceCommit()))
                    .toList();
        }

        // Phân loại các alert vi phạm mức độ nghiêm trọng (minSeverity)
        boolean hasCritical = openAlerts.stream().anyMatch(a -> "CRITICAL".equalsIgnoreCase(a.getSeverity()));
        boolean hasHigh = openAlerts.stream().anyMatch(a -> "HIGH".equalsIgnoreCase(a.getSeverity()));

        boolean isBlocking = "CRITICAL".equalsIgnoreCase(policy.getMinSeverity())
                ? hasCritical
                : (hasCritical || hasHigh);

        String token = resolveToken(repo);
        String[] parts = repo.getRepoFullName().split("/");
        if (parts.length != 2 || !StringUtils.hasText(token)) {
            log.warn("[PrMergeBlocking] Thiếu GitHub token hoặc repoFullName không hợp lệ ({})", repo.getRepoFullName());
            return null;
        }
        String owner = parts[0];
        String repoName = parts[1];

        String detailsUrl = frontendUrl + "/canh-bao-sai-lech";

        if (isBlocking) {
            // Có sai lệch nghiêm trọng -> BÁO ĐỎ
            boolean isStrict = "STRICT".equalsIgnoreCase(policy.getBlockingMode());
            String conclusion = isStrict ? "failure" : "neutral";
            String title = String.format("LivingDocs: Phát hiện %d sai lệch tài liệu nghiêm trọng (%s)",
                    openAlerts.size(), hasCritical ? "CRITICAL" : "HIGH");
            String summary = String.format(
                    "### ⚠️ Yêu cầu cập nhật tài liệu trước khi gộp mã nguồn\n\n" +
                    "- **Chế độ kiểm soát**: %s\n" +
                    "- **Số tài liệu bị ảnh hưởng**: %d tài liệu\n" +
                    "- **Mức độ rủi ro cao nhất**: %s\n\n" +
                    "Hệ thống phát hiện các thay đổi mã nguồn trong PR #%d làm tài liệu kỹ thuật bị trôi dạt nghiêm trọng. " +
                    (isStrict ? "Pull Request này bị CHẶN gộp cho đến khi tài liệu tương ứng được tạo bản nháp và phê duyệt."
                              : "Vui lòng xem xét cập nhật tài liệu để tránh trôi dạt thông tin kiến trúc.") +
                    "\n\n[👉 Mở Trung tâm Cảnh báo LivingDocs để xử lý](%s)",
                    isStrict ? "CHẶN CỨNG (Strict Block)" : "CẢNH BÁO NHẮC NHỞ (Warn Only)",
                    openAlerts.size(),
                    hasCritical ? "CRITICAL" : "HIGH",
                    prNumber,
                    detailsUrl
            );

            log.info("[PrMergeBlocking] Gửi Check BÁO ĐỎ ({}) lên GitHub PR #{} (SHA: {})", conclusion, prNumber, finalSha);
            return gitHubClient.postCheckRun(
                    token, owner, repoName, finalSha,
                    policy.getCheckName(), "completed", conclusion,
                    title, summary, detailsUrl
            );
        } else {
            // Không có sai lệch nghiêm trọng hoặc đã xử lý xong -> BÁO XANH
            String title = "LivingDocs: Tài liệu đồng bộ hoàn toàn hợp lệ";
            String summary = String.format(
                    "### ✅ Kiểm tra tài liệu đã vượt qua thành công\n\n" +
                    "Không phát hiện sai lệch nghiêm trọng nào giữa mã nguồn trong PR #%d và tài liệu kỹ thuật hiện hành. " +
                    "Pull Request đã sẵn sàng để hợp nhất vào nhánh chính.",
                    prNumber
            );

            log.info("[PrMergeBlocking] Gửi Check BÁO XANH (success) lên GitHub PR #{} (SHA: {})", prNumber, finalSha);
            return gitHubClient.postCheckRun(
                    token, owner, repoName, finalSha,
                    policy.getCheckName(), "completed", "success",
                    title, summary, detailsUrl
            );
        }
    }

    @Override
    @Transactional
    public void notifyDocumentApproved(Long documentId) {
        PrMergeBlockingPolicyDto policy = getBlockingPolicy();
        if (!Boolean.TRUE.equals(policy.getEnabled()) || !Boolean.TRUE.equals(policy.getAutoUnlockOnApproval())) {
            return;
        }

        // Tìm tất cả cảnh báo drift liên quan đến documentId này
        List<DocumentChangeAlertEntity> alerts = alertRepository.findAll().stream()
                .filter(a -> documentId.equals(a.getDocumentId()))
                .toList();

        if (alerts.isEmpty()) {
            return;
        }

        // Đánh dấu RESOLVED các alerts liên quan nếu tài liệu đã APPROVED/PUBLISHED
        Document doc = documentRepositoryPort.findById(documentId).orElse(null);
        if (doc != null && (doc.getStatus() == DocumentStatus.APPROVED || doc.getStatus() == DocumentStatus.PUBLISHED)) {
            for (DocumentChangeAlertEntity alert : alerts) {
                if ("OPEN".equalsIgnoreCase(alert.getStatus())) {
                    alert.setStatus("RESOLVED");
                    alert.setResolvedAt(Instant.now());
                }
            }
            alertRepository.saveAll(alerts);
            log.info("[PrMergeBlocking] Đã tự động cập nhật RESOLVED cho {} cảnh báo của tài liệu #{}", alerts.size(), documentId);
        }

        // Nhóm theo PR để kiểm tra xem PR đó còn alert OPEN nào không
        Set<Long> prIds = new HashSet<>();
        for (DocumentChangeAlertEntity alert : alerts) {
            if (alert.getSourcePrId() != null) {
                prIds.add(alert.getSourcePrId());
            }
        }

        for (Long prId : prIds) {
            PullRequestEntity pr = pullRequestRepository.findById(prId).orElse(null);
            if (pr == null || "MERGED".equalsIgnoreCase(pr.getState()) || "CLOSED".equalsIgnoreCase(pr.getState())) {
                continue;
            }

            // Đánh giá lại và gửi lại Check Run cho PR này (nếu hết lỗi nghiêm trọng, Check sẽ chuyển thành XANH)
            log.info("[PrMergeBlocking] Tài liệu #{} được duyệt. Đang đánh giá lại Check Run cho PR #{}", documentId, pr.getPrNumber());
            evaluateAndSendPrCheck(pr.getRepositoryId(), pr.getPrNumber(), pr.getHeadCommitHash());
        }
    }

    private String resolveToken(RepositoryEntity repo) {
        if (repo.getConnectionId() != null) {
            Optional<GitHubConnectionEntity> connOpt = gitHubConnectionRepository.findById(repo.getConnectionId());
            if (connOpt.isPresent() && StringUtils.hasText(connOpt.get().getAccessTokenEncrypted())) {
                return connOpt.get().getAccessTokenEncrypted();
            }
        }
        if (repo.getWorkspaceId() != null) {
            List<GitHubConnectionEntity> wsConns = gitHubConnectionRepository.findByWorkspaceId(repo.getWorkspaceId());
            if (!wsConns.isEmpty() && StringUtils.hasText(wsConns.get(0).getAccessTokenEncrypted())) {
                return wsConns.get(0).getAccessTokenEncrypted();
            }
        }
        String token = System.getenv("GITHUB_TOKEN");
        if (StringUtils.hasText(token)) {
            return token.trim();
        }
        return System.getProperty("github.token", "");
    }

    private PrMergeBlockingPolicyDto defaultPolicy() {
        return PrMergeBlockingPolicyDto.builder()
                .enabled(true)
                .blockingMode("STRICT")
                .minSeverity("CRITICAL")
                .checkName("LivingDocs / Doc Drift Guard")
                .autoUnlockOnApproval(true)
                .updatedAt(Instant.now())
                .updatedBy("SYSTEM")
                .build();
    }
}
