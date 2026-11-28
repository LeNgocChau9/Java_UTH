package com.example.livingdocs_backend.infrastructure.security;

import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Central multi-tenant (Enterprise / Workspace) access guard.
 * Reads the DB-backed {@link UserPrincipal} from {@link SecurityContextHolder} and verifies
 * resource ownership across Enterprises using lightweight JDBC lookups.
 */
@Service
public class TenantAccessService {

    public static final long DEFAULT_WORKSPACE_ID = 1L;
    public static final String ERR_NO_ENTERPRISE = "NO_ENTERPRISE_ASSIGNED";
    public static final String ERR_TENANT_DENIED = "TENANT_ACCESS_DENIED";
    public static final String MSG_NO_ENTERPRISE =
            "Tài khoản của bạn chưa được phân vào doanh nghiệp nào. Vui lòng liên hệ Quản trị viên.";
    public static final String MSG_TENANT_DENIED =
            "Bạn không có quyền truy cập tài nguyên thuộc doanh nghiệp khác.";

    private final JdbcTemplate jdbcTemplate;

    public record TenantScope(
            boolean systemBypass,
            boolean admin,
            boolean globalAdmin,
            Long workspaceId,
            boolean unassigned,
            Long userId
    ) {
        public boolean hasTenantFilter() {
            return !systemBypass && !globalAdmin && workspaceId != null;
        }
    }

    public TenantAccessService() {
        this(null);
    }

    @Autowired
    public TenantAccessService(@Autowired(required = false) JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public TenantScope currentScope() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            return new TenantScope(true, false, false, null, false, null);
        }
        boolean admin = principal.isAdmin();
        Long effectiveWorkspaceId = principal.getEffectiveWorkspaceId();
        boolean globalAdmin = admin && effectiveWorkspaceId == null;
        boolean unassigned = !admin && effectiveWorkspaceId == null;
        return new TenantScope(false, admin, globalAdmin, effectiveWorkspaceId, unassigned, principal.getUserId());
    }

    /**
     * Resolves the effective workspace filter for read endpoints:
     * - systemBypass: requestedWorkspaceId (nullable)
     * - ADMIN: requestedWorkspaceId if supplied, else X-Enterprise-Id header (null = all enterprises)
     * - Unassigned non-ADMIN: null (caller checks {@code scope.unassigned()} to return empty list)
     * - Assigned non-ADMIN: user's workspaceId (throws 403 if requestedWorkspaceId mismatches)
     */
    public Long resolveReadWorkspaceId(Long requestedWorkspaceId) {
        TenantScope scope = currentScope();
        if (scope.systemBypass()) {
            return requestedWorkspaceId;
        }
        if (scope.admin()) {
            return requestedWorkspaceId != null ? requestedWorkspaceId : scope.workspaceId();
        }
        if (scope.unassigned()) {
            return null;
        }
        if (requestedWorkspaceId != null && !requestedWorkspaceId.equals(scope.workspaceId())) {
            throw AuthenticationException.forbidden(ERR_TENANT_DENIED, MSG_TENANT_DENIED);
        }
        return scope.workspaceId();
    }

    /**
     * Resolves the target workspace for write operations:
     * - systemBypass: requestedWorkspaceId or DEFAULT_WORKSPACE_ID
     * - ADMIN: requestedWorkspaceId -> X-Enterprise-Id -> admin's workspaceId -> DEFAULT_WORKSPACE_ID
     * - Unassigned non-ADMIN: throws 403 NO_ENTERPRISE_ASSIGNED
     * - Assigned non-ADMIN: enforces requestedWorkspaceId matches user's workspaceId (else 403 TENANT_ACCESS_DENIED)
     */
    public Long resolveWriteWorkspaceId(Long requestedWorkspaceId) {
        TenantScope scope = currentScope();
        if (scope.systemBypass()) {
            return requestedWorkspaceId != null ? requestedWorkspaceId : DEFAULT_WORKSPACE_ID;
        }
        if (scope.admin()) {
            if (requestedWorkspaceId != null) {
                return requestedWorkspaceId;
            }
            if (scope.workspaceId() != null) {
                return scope.workspaceId();
            }
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal && principal.getWorkspaceId() != null) {
                return principal.getWorkspaceId();
            }
            return DEFAULT_WORKSPACE_ID;
        }
        if (scope.unassigned()) {
            throw AuthenticationException.forbidden(ERR_NO_ENTERPRISE, MSG_NO_ENTERPRISE);
        }
        if (requestedWorkspaceId != null && !requestedWorkspaceId.equals(scope.workspaceId())) {
            throw AuthenticationException.forbidden(ERR_TENANT_DENIED, MSG_TENANT_DENIED);
        }
        return scope.workspaceId();
    }

    public void requireWorkspaceAccess(Long targetWorkspaceId) {
        TenantScope scope = currentScope();
        if (scope.systemBypass() || scope.globalAdmin()) {
            return;
        }
        if (scope.unassigned()) {
            throw AuthenticationException.forbidden(ERR_NO_ENTERPRISE, MSG_NO_ENTERPRISE);
        }
        if (targetWorkspaceId == null) {
            if (scope.admin()) {
                return;
            }
            throw AuthenticationException.forbidden(ERR_TENANT_DENIED, MSG_TENANT_DENIED);
        }
        if (!targetWorkspaceId.equals(scope.workspaceId())) {
            throw AuthenticationException.forbidden(ERR_TENANT_DENIED, MSG_TENANT_DENIED);
        }
    }

    public Long requireRepositoryAccess(Long repositoryId) {
        return requireResourceWorkspace(
                repositoryId,
                "SELECT workspace_id FROM repositories WHERE repository_id = ?",
                "Không tìm thấy kho mã nguồn #" + repositoryId
        );
    }

    public Long requireDocumentAccess(Long docId) {
        return requireResourceWorkspace(
                docId,
                "SELECT r.workspace_id FROM documents d LEFT JOIN repositories r ON r.repository_id = d.repo_id WHERE d.doc_id = ?",
                "Không tìm thấy tài liệu #" + docId
        );
    }

    public Long requireCollectionAccess(Long collectionId) {
        return requireResourceWorkspace(
                collectionId,
                "SELECT workspace_id FROM doc_collections WHERE id = ?",
                "Không tìm thấy bộ tài liệu #" + collectionId
        );
    }

    public Long requireAlertAccess(Long alertId) {
        TenantScope scope = currentScope();
        if (scope.systemBypass() || scope.globalAdmin()) {
            return null;
        }
        if (scope.unassigned()) {
            throw AuthenticationException.forbidden(ERR_NO_ENTERPRISE, MSG_NO_ENTERPRISE);
        }
        if (alertId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo sai lệch");
        }
        if (jdbcTemplate == null) {
            return scope.workspaceId();
        }
        List<Long> wsIds = jdbcTemplate.query(
                "SELECT r.workspace_id FROM document_change_alerts a LEFT JOIN repositories r ON r.repository_id = a.repository_id WHERE a.alert_id = ?",
                (rs, rowNum) -> {
                    long v = rs.getLong(1);
                    return rs.wasNull() ? null : v;
                },
                alertId
        );
        if (wsIds.isEmpty()) {
            wsIds = jdbcTemplate.query(
                    "SELECT r.workspace_id FROM drift_alerts a LEFT JOIN repositories r ON r.repository_id = a.repo_id WHERE a.alert_id = ?",
                    (rs, rowNum) -> {
                        long v = rs.getLong(1);
                        return rs.wasNull() ? null : v;
                    },
                    alertId
            );
        }
        if (wsIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo sai lệch #" + alertId);
        }
        Long ownerWorkspaceId = wsIds.get(0);
        requireWorkspaceAccess(ownerWorkspaceId);
        return ownerWorkspaceId;
    }

    public Long requireJobAccess(Long jobId) {
        return requireResourceWorkspace(
                jobId,
                "SELECT workspace_id FROM jobs WHERE job_id = ?",
                "Không tìm thấy tác vụ nền #" + jobId
        );
    }

    public Long requireCiTokenAccess(Long tokenId) {
        return requireResourceWorkspace(
                tokenId,
                "SELECT workspace_id FROM ci_tokens WHERE token_id = ?",
                "Không tìm thấy CI token #" + tokenId
        );
    }

    public Long requireConnectionAccess(Long connectionId) {
        return requireResourceWorkspace(
                connectionId,
                "SELECT workspace_id FROM github_connections WHERE connection_id = ?",
                "Không tìm thấy kết nối GitHub #" + connectionId
        );
    }

    private Long requireResourceWorkspace(Long resourceId, String sql, String notFoundMessage) {
        TenantScope scope = currentScope();
        if (scope.systemBypass() || scope.globalAdmin()) {
            return null;
        }
        if (scope.unassigned()) {
            throw AuthenticationException.forbidden(ERR_NO_ENTERPRISE, MSG_NO_ENTERPRISE);
        }
        if (resourceId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, notFoundMessage);
        }
        if (jdbcTemplate == null) {
            return scope.workspaceId();
        }
        List<Long> wsIds = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> {
                    long v = rs.getLong(1);
                    return rs.wasNull() ? null : v;
                },
                resourceId
        );
        if (wsIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, notFoundMessage);
        }
        Long ownerWorkspaceId = wsIds.get(0);
        requireWorkspaceAccess(ownerWorkspaceId);
        return ownerWorkspaceId;
    }
}
