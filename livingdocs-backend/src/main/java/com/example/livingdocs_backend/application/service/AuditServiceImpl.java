package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AuditCleanupResultDto;
import com.example.livingdocs_backend.application.dto.AuditRetentionConfigDto;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.AuditLog;
import com.example.livingdocs_backend.domain.repository.AuditLogRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ChangelogRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditServicePort {

    public static final String AUDIT_RETENTION_SETTING_KEY = "audit_retention_policy";

    private final AuditLogRepositoryPort auditLogRepositoryPort;
    private final ChangelogRepositoryPort changelogRepositoryPort;
    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.security.TenantAccessService tenantAccessService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.livingdocs_backend.domain.repository.UserRepositoryPort userRepositoryPort;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository documentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository repositoryRepository;

    @Override
    public void recordLogin(Long actorId, String actorEmail, boolean successful) {
        AuditAction action = successful ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILURE;
        record(actorId, action, "USER", actorId != null ? actorId.toString() : null,
                "email=" + actorEmail);
    }

    @Override
    public void recordRoleChange(Long actorId, String actorEmail, Long targetUserId,
                                 String previousRoles, String newRole) {
        record(actorId, AuditAction.ROLE_CHANGED, "USER", targetUserId.toString(),
                "actorEmail=" + actorEmail + "; previousRoles=" + previousRoles + "; newRole=" + newRole);
    }

    @Override
    public void recordDocumentDeletion(Long actorId, Long documentId) {
        record(actorId, AuditAction.DOCUMENT_DELETED, "DOCUMENT", documentId.toString(), null);
    }

    @Override
    public void recordDocumentApproval(Long actorId, Long documentId) {
        record(actorId, AuditAction.DOCUMENT_APPROVED, "DOCUMENT", documentId.toString(), null);
    }

    @Override
    public void recordDocumentAction(Long actorId, Long documentId, AuditAction action, String detail) {
        record(actorId, action, "DOCUMENT", documentId.toString(), detail);
    }

    @Override
    public void recordSecurityAction(Long actorId, AuditAction action, String resourceType, String resourceId, String detail) {
        record(actorId, action, resourceType, resourceId, detail);
    }

    @Override
    public java.util.List<AuditLog> getAuditLogsForResource(String resourceType, String resourceId) {
        if (tenantAccessService != null) {
            Long parsedId = parseLongOrNull(resourceId);
            if ("DOCUMENT".equalsIgnoreCase(resourceType) && parsedId != null) {
                tenantAccessService.requireDocumentAccess(parsedId);
            } else if ("REPOSITORY".equalsIgnoreCase(resourceType) && parsedId != null) {
                tenantAccessService.requireRepositoryAccess(parsedId);
            }
            var scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return java.util.Collections.emptyList();
            }
            List<AuditLog> list = auditLogRepositoryPort.findByResourceTypeAndResourceId(resourceType, resourceId);
            if (scope.hasTenantFilter()) {
                return list.stream()
                        .filter(l -> l.getWorkspaceId() == null || scope.workspaceId().equals(l.getWorkspaceId()))
                        .toList();
            }
            return list;
        }
        return auditLogRepositoryPort.findByResourceTypeAndResourceId(resourceType, resourceId);
    }

    @Override
    public List<AuditLog> search(String action, Instant from, Instant to) {
        String wanted = action == null ? "" : action.trim().toUpperCase();
        List<AuditLog> source;
        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return java.util.Collections.emptyList();
            }
            source = scope.hasTenantFilter()
                    ? auditLogRepositoryPort.findRecentByWorkspaceId(scope.workspaceId())
                    : auditLogRepositoryPort.findRecent();
        } else {
            source = auditLogRepositoryPort.findRecent();
        }
        return source.stream()
                .filter(log -> wanted.isEmpty() || (log.getAction() != null && log.getAction().name().equals(wanted)))
                .filter(log -> from == null || (log.getCreatedAt() != null && !log.getCreatedAt().isBefore(from)))
                .filter(log -> to == null || (log.getCreatedAt() != null && !log.getCreatedAt().isAfter(to)))
                .toList();
    }

    @Override
    public AuditRetentionConfigDto getRetentionConfig() {
        return adminSettingRepository.findById(AUDIT_RETENTION_SETTING_KEY)
                .map(entity -> {
                    try {
                        return objectMapper.readValue(entity.getSettingValue(), AuditRetentionConfigDto.class);
                    } catch (Exception e) {
                        log.warn("Lỗi đọc cấu hình retention policy từ admin_settings: {}", e.getMessage());
                        return defaultRetentionConfig();
                    }
                })
                .orElseGet(this::defaultRetentionConfig);
    }

    @Override
    @Transactional
    public AuditRetentionConfigDto updateRetentionConfig(AuditRetentionConfigDto request, Long actorId) {
        int retentionDays = (request != null && request.getRetentionDays() != null)
                ? request.getRetentionDays()
                : 90;
        if (retentionDays < 30) {
            retentionDays = 30;
        } else if (retentionDays > 365) {
            retentionDays = 365;
        }

        AuditRetentionConfigDto current = getRetentionConfig();
        AuditRetentionConfigDto updated = AuditRetentionConfigDto.builder()
                .retentionDays(retentionDays)
                .autoCleanupEnabled(request != null && request.getAutoCleanupEnabled() != null ? request.getAutoCleanupEnabled() : current.getAutoCleanupEnabled())
                .cleanupCron((request != null && request.getCleanupCron() != null && !request.getCleanupCron().isBlank()) ? request.getCleanupCron() : current.getCleanupCron())
                .lastCleanupAt(current.getLastCleanupAt())
                .lastCleanupStatus(current.getLastCleanupStatus())
                .lastAuditLogsDeleted(current.getLastAuditLogsDeleted())
                .lastChangelogsDeleted(current.getLastChangelogsDeleted())
                .updatedBy(actorId)
                .updatedAt(Instant.now())
                .build();

        try {
            String json = objectMapper.writeValueAsString(updated);
            adminSettingRepository.save(AdminSettingEntity.builder()
                    .settingKey(AUDIT_RETENTION_SETTING_KEY)
                    .settingValue(json)
                    .build());
        } catch (Exception e) {
            log.error("Lỗi lưu cấu hình retention policy vào admin_settings: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu cấu hình retention policy: " + e.getMessage(), e);
        }

        record(actorId, AuditAction.USER_UPDATED, "SYSTEM", AUDIT_RETENTION_SETTING_KEY,
                "Cập nhật chính sách lưu trữ: retentionDays=" + retentionDays + ", autoCleanup=" + updated.getAutoCleanupEnabled());

        return updated;
    }

    @Override
    @Transactional
    public AuditCleanupResultDto cleanupExpiredLogs(Integer customRetentionDays, Long actorId, String triggerMethod) {
        AuditRetentionConfigDto config = getRetentionConfig();
        int days = (customRetentionDays != null && customRetentionDays > 0)
                ? customRetentionDays
                : (config.getRetentionDays() != null ? config.getRetentionDays() : 90);

        if (days < 30) {
            days = 30;
        } else if (days > 365) {
            days = 365;
        }

        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        String trigger = (triggerMethod != null && !triggerMethod.isBlank()) ? triggerMethod : "MANUAL";

        log.info("Bắt đầu tiến trình dọn dẹp audit_logs & changelogs quá hạn: days={}, cutoff={}, trigger={}", days, cutoff, trigger);

        long changelogsDeleted = 0;
        long auditLogsDeleted = 0;
        boolean success = true;
        String errorMessage = null;

        try {
            changelogsDeleted = changelogRepositoryPort.deleteByCreatedAtBefore(cutoff);
            auditLogsDeleted = auditLogRepositoryPort.deleteByCreatedAtBefore(cutoff);
            log.info("Dọn dẹp thành công: {} audit_logs, {} changelogs", auditLogsDeleted, changelogsDeleted);
        } catch (Exception e) {
            success = false;
            errorMessage = e.getMessage();
            log.error("Lỗi trong quá trình dọn dẹp audit_logs & changelogs: {}", e.getMessage(), e);
            throw e;
        } finally {
            // Cập nhật trạng thái lần dọn dẹp gần nhất vào config
            try {
                AuditRetentionConfigDto latestConfig = getRetentionConfig();
                AuditRetentionConfigDto updatedConfig = AuditRetentionConfigDto.builder()
                        .retentionDays(latestConfig.getRetentionDays())
                        .autoCleanupEnabled(latestConfig.getAutoCleanupEnabled())
                        .cleanupCron(latestConfig.getCleanupCron())
                        .lastCleanupAt(Instant.now())
                        .lastCleanupStatus(success ? "SUCCESS" : "FAILED: " + errorMessage)
                        .lastAuditLogsDeleted(auditLogsDeleted)
                        .lastChangelogsDeleted(changelogsDeleted)
                        .updatedBy(latestConfig.getUpdatedBy())
                        .updatedAt(latestConfig.getUpdatedAt())
                        .build();
                adminSettingRepository.save(AdminSettingEntity.builder()
                        .settingKey(AUDIT_RETENTION_SETTING_KEY)
                        .settingValue(objectMapper.writeValueAsString(updatedConfig))
                        .build());
            } catch (Exception ex) {
                log.warn("Không thể cập nhật kết quả dọn dẹp vào admin_settings: {}", ex.getMessage());
            }

            // Ghi nhật ký kiểm toán mới về thao tác dọn dẹp
            String detail = String.format("Dọn dẹp thành công %d bản ghi audit_logs và %d bản ghi changelogs cũ hơn %d ngày (cutoff: %s, trigger: %s)",
                    auditLogsDeleted, changelogsDeleted, days, cutoff, trigger);
            record(actorId, AuditAction.AUDIT_LOG_CLEANUP, "SYSTEM", "AUDIT_CLEANUP", detail);
        }

        return AuditCleanupResultDto.builder()
                .auditLogsDeleted(auditLogsDeleted)
                .changelogsDeleted(changelogsDeleted)
                .cutoffTime(cutoff)
                .retentionDaysApplied(days)
                .executedAt(Instant.now())
                .triggerMethod(trigger)
                .message(String.format("Đã dọn dẹp an toàn %d nhật ký kiểm toán và %d lịch sử thay đổi quá hạn %d ngày.", auditLogsDeleted, changelogsDeleted, days))
                .build();
    }

    private AuditRetentionConfigDto defaultRetentionConfig() {
        return AuditRetentionConfigDto.builder()
                .retentionDays(90)
                .autoCleanupEnabled(true)
                .cleanupCron("0 0 2 * * ?")
                .lastCleanupStatus("NEVER_RUN")
                .lastAuditLogsDeleted(0L)
                .lastChangelogsDeleted(0L)
                .build();
    }

    private void record(Long actorId, AuditAction action, String resourceType,
                        String resourceId, String detail) {
        Long workspaceId = resolveWorkspaceIdForAudit(actorId, resourceType, resourceId);
        auditLogRepositoryPort.save(AuditLog.builder()
                .workspaceId(workspaceId)
                .actorId(actorId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .detail(detail)
                .build());
    }

    private Long resolveWorkspaceIdForAudit(Long actorId, String resourceType, String resourceId) {
        try {
            if (tenantAccessService != null) {
                var scope = tenantAccessService.currentScope();
                if (scope.hasTenantFilter()) {
                    return scope.workspaceId();
                }
            }
            Long parsedId = parseLongOrNull(resourceId);
            if ("ENTERPRISE".equalsIgnoreCase(resourceType) && parsedId != null) {
                return parsedId;
            }
            if ("DOCUMENT".equalsIgnoreCase(resourceType) && parsedId != null
                    && documentRepository != null && repositoryRepository != null) {
                var docOpt = documentRepository.findById(parsedId);
                if (docOpt.isPresent() && docOpt.get().getRepoId() != null) {
                    var repoOpt = repositoryRepository.findById(docOpt.get().getRepoId());
                    if (repoOpt.isPresent() && repoOpt.get().getWorkspaceId() != null) {
                        return repoOpt.get().getWorkspaceId();
                    }
                }
            }
            if ("REPOSITORY".equalsIgnoreCase(resourceType) && parsedId != null && repositoryRepository != null) {
                var repoOpt = repositoryRepository.findById(parsedId);
                if (repoOpt.isPresent() && repoOpt.get().getWorkspaceId() != null) {
                    return repoOpt.get().getWorkspaceId();
                }
            }
            if (actorId != null && userRepositoryPort != null) {
                return userRepositoryPort.findById(actorId)
                        .map(com.example.livingdocs_backend.domain.model.User::getWorkspaceId)
                        .orElse(null);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static Long parseLongOrNull(String val) {
        if (val == null || val.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(val.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
