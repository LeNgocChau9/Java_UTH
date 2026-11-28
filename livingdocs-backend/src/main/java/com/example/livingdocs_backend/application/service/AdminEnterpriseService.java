package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.AdminUserResponse;
import com.example.livingdocs_backend.application.dto.EnterpriseRequest;
import com.example.livingdocs_backend.application.dto.EnterpriseResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.WorkspaceEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataWorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Enterprise (Doanh nghiệp) management backed directly by the {@code workspaces} table.
 */
@Service
@RequiredArgsConstructor
public class AdminEnterpriseService {

    private static final long CORE_WORKSPACE_ID = 1L;

    private final SpringDataWorkspaceRepository workspaceRepository;
    private final SpringDataUserRepository springDataUserRepository;
    private final UserRepositoryPort userRepositoryPort;
    private final AdminUserServiceImpl adminUserService;
    private final AuditServicePort auditServicePort;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    public List<EnterpriseResponse> listEnterprises() {
        List<WorkspaceEntity> workspaces = workspaceRepository.findAllByOrderByWorkspaceIdAsc();
        Map<Long, Long> userCounts = loadCountMap(
                "SELECT workspace_id, COUNT(*) FROM users WHERE workspace_id IS NOT NULL GROUP BY workspace_id");
        Map<Long, Long> repoCounts = loadCountMap(
                "SELECT workspace_id, COUNT(*) FROM repositories GROUP BY workspace_id");

        return workspaces.stream()
                .map(ws -> toResponse(
                        ws,
                        userCounts.getOrDefault(ws.getWorkspaceId(), 0L),
                        repoCounts.getOrDefault(ws.getWorkspaceId(), 0L)))
                .toList();
    }

    @Transactional
    public EnterpriseResponse createEnterprise(EnterpriseRequest request, Long actorId, String actorEmail) {
        String name = request.getName().trim();
        if (workspaceRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên doanh nghiệp '" + name + "' đã tồn tại.");
        }

        String slug = generateUniqueSlug(name);
        Long ownerId = resolveValidOwnerId(actorId);

        WorkspaceEntity saved = workspaceRepository.save(WorkspaceEntity.builder()
                .name(name)
                .slug(slug)
                .ownerId(ownerId)
                .build());

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.ENTERPRISE_CREATED,
                    "ENTERPRISE",
                    String.valueOf(saved.getWorkspaceId()),
                    "Admin (" + actorEmail + ") tạo doanh nghiệp: " + saved.getName()
            );
        }

        return toResponse(saved, 0L, 0L);
    }

    @Transactional
    public EnterpriseResponse renameEnterprise(Long enterpriseId, EnterpriseRequest request, Long actorId, String actorEmail) {
        WorkspaceEntity ws = workspaceRepository.findById(enterpriseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy doanh nghiệp #" + enterpriseId));

        String newName = request.getName().trim();
        if (workspaceRepository.existsByNameIgnoreCaseAndWorkspaceIdNot(newName, enterpriseId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên doanh nghiệp '" + newName + "' đã tồn tại.");
        }

        String oldName = ws.getName();
        ws.setName(newName);
        WorkspaceEntity saved = workspaceRepository.save(ws);

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.ENTERPRISE_UPDATED,
                    "ENTERPRISE",
                    String.valueOf(enterpriseId),
                    "Admin (" + actorEmail + ") đổi tên doanh nghiệp: '" + oldName + "' -> '" + newName + "'"
            );
        }

        long userCount = springDataUserRepository.countByWorkspaceId(enterpriseId);
        long repoCount = countRepositories(enterpriseId);
        return toResponse(saved, userCount, repoCount);
    }

    @Transactional
    public Map<String, Object> deleteEnterprise(Long enterpriseId, boolean force, Long actorId, String actorEmail) {
        if (enterpriseId == null || enterpriseId == CORE_WORKSPACE_ID) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa Doanh nghiệp mặc định của hệ thống (chỉ có thể đổi tên)."
            );
        }

        WorkspaceEntity ws = workspaceRepository.findById(enterpriseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy doanh nghiệp #" + enterpriseId));

        long repoCount = countRepositories(enterpriseId);
        if (repoCount > 0 && !force) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Doanh nghiệp '" + ws.getName() + "' đang có " + repoCount
                            + " kho mã nguồn. Xác nhận xóa bắt buộc (force=true) để xóa toàn bộ dữ liệu liên quan."
            );
        }

        // 1. Gỡ doanh nghiệp khỏi toàn bộ tài khoản thành viên (không xóa user)
        springDataUserRepository.clearWorkspaceForUsers(enterpriseId);
        springDataUserRepository.deleteWorkspaceMembersByWorkspaceId(enterpriseId);

        // 2. Xóa dữ liệu phụ thuộc theo thứ tự tránh vi phạm FK RESTRICT (repositories -> github_connections)
        if (jdbcTemplate != null) {
            execUpdateQuietly(
                    "DELETE FROM doc_code_links WHERE document_id IN (SELECT doc_id FROM documents WHERE repo_id IN (SELECT repository_id FROM repositories WHERE workspace_id = ?))",
                    enterpriseId);
            execUpdateQuietly(
                    "DELETE FROM changelogs WHERE document_id IN (SELECT doc_id FROM documents WHERE repo_id IN (SELECT repository_id FROM repositories WHERE workspace_id = ?))",
                    enterpriseId);
            execUpdateQuietly(
                    "DELETE FROM drift_alerts WHERE repo_id IN (SELECT repository_id FROM repositories WHERE workspace_id = ?)",
                    enterpriseId);
            execUpdateQuietly(
                    "DELETE FROM documents WHERE repo_id IN (SELECT repository_id FROM repositories WHERE workspace_id = ?)",
                    enterpriseId);
            execUpdateQuietly("DELETE FROM repositories WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM github_connections WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM doc_collections WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM ci_tokens WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM document_update_policies WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM document_change_policies WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM manager_approval_policies WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM manager_approval_delegations WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM external_integrations WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("DELETE FROM doc_templates WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("UPDATE audit_logs SET workspace_id = NULL WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("UPDATE jobs SET workspace_id = NULL WHERE workspace_id = ?", enterpriseId);
            execUpdateQuietly("UPDATE webhook_deliveries SET workspace_id = NULL WHERE workspace_id = ?", enterpriseId);
        }

        workspaceRepository.deleteById(enterpriseId);

        if (auditServicePort != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.ENTERPRISE_DELETED,
                    "ENTERPRISE",
                    String.valueOf(enterpriseId),
                    "Admin (" + actorEmail + ") xóa doanh nghiệp '" + ws.getName() + "' (force=" + force + ", repos=" + repoCount + ")"
            );
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "DELETED");
        result.put("enterpriseId", enterpriseId);
        result.put("message", "Đã xóa doanh nghiệp '" + ws.getName() + "' thành công.");
        return result;
    }

    @Transactional
    public List<AdminUserResponse> assignUsersToEnterprise(Long enterpriseId, List<Long> userIds, Long actorId, String actorEmail) {
        WorkspaceEntity ws = workspaceRepository.findById(enterpriseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy doanh nghiệp #" + enterpriseId));

        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> uniqueIds = new LinkedHashSet<>();
        for (Long id : userIds) {
            if (id != null) {
                uniqueIds.add(id);
            }
        }

        List<AdminUserResponse> updated = new ArrayList<>();
        for (Long userId : uniqueIds) {
            User user = userRepositoryPort.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Không tìm thấy người dùng #" + userId));
            userRepositoryPort.assignEnterprise(userId, enterpriseId);
            if (auditServicePort != null) {
                auditServicePort.recordSecurityAction(
                        actorId,
                        AuditAction.USER_ENTERPRISE_CHANGED,
                        "USER",
                        String.valueOf(userId),
                        "Admin (" + actorEmail + ") phân tài khoản " + user.getEmail() + " vào doanh nghiệp '" + ws.getName() + "'"
                );
            }
            updated.add(adminUserService.toResponse(userRepositoryPort.findById(userId).orElse(user)));
        }
        return updated;
    }

    @Transactional
    public AdminUserResponse removeUserFromEnterprise(Long enterpriseId, Long userId, Long actorId, String actorEmail) {
        WorkspaceEntity ws = workspaceRepository.findById(enterpriseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy doanh nghiệp #" + enterpriseId));

        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy người dùng #" + userId));

        if (enterpriseId.equals(user.getWorkspaceId())) {
            userRepositoryPort.assignEnterprise(userId, null);
            if (auditServicePort != null) {
                auditServicePort.recordSecurityAction(
                        actorId,
                        AuditAction.USER_ENTERPRISE_CHANGED,
                        "USER",
                        String.valueOf(userId),
                        "Admin (" + actorEmail + ") gỡ tài khoản " + user.getEmail() + " khỏi doanh nghiệp '" + ws.getName() + "'"
                );
            }
        }
        return adminUserService.toResponse(userRepositoryPort.findById(userId).orElse(user));
    }

    private Long resolveValidOwnerId(Long actorId) {
        if (actorId != null && springDataUserRepository.existsById(actorId)) {
            return actorId;
        }
        if (jdbcTemplate != null) {
            try {
                Long minId = jdbcTemplate.queryForObject("SELECT MIN(user_id) FROM users", Long.class);
                if (minId != null) {
                    return minId;
                }
            } catch (Exception ignored) {
            }
        }
        return 1L;
    }

    private String generateUniqueSlug(String name) {
        String normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        String base = normalized.isBlank() ? "enterprise" : normalized;
        if (base.length() > 130) {
            base = base.substring(0, 130);
        }
        String candidate = base;
        int suffix = 2;
        while (workspaceRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    private long countRepositories(Long workspaceId) {
        if (jdbcTemplate == null) {
            return 0L;
        }
        try {
            Long count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM repositories WHERE workspace_id = ?", Long.class, workspaceId);
            return count != null ? count : 0L;
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private Map<Long, Long> loadCountMap(String sql) {
        if (jdbcTemplate == null) {
            return Collections.emptyMap();
        }
        try {
            Map<Long, Long> counts = new HashMap<>();
            jdbcTemplate.query(sql, rs -> {
                long id = rs.getLong(1);
                if (!rs.wasNull()) {
                    counts.put(id, rs.getLong(2));
                }
            });
            return counts;
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
    }

    private void execUpdateQuietly(String sql, Object... args) {
        try {
            jdbcTemplate.update(sql, args);
        } catch (Exception ignored) {
        }
    }

    private EnterpriseResponse toResponse(WorkspaceEntity ws, long userCount, long repoCount) {
        return EnterpriseResponse.builder()
                .enterpriseId(ws.getWorkspaceId())
                .name(ws.getName())
                .slug(ws.getSlug())
                .userCount(userCount)
                .repositoryCount(repoCount)
                .createdAt(ws.getCreatedAt())
                .updatedAt(ws.getUpdatedAt())
                .build();
    }
}
