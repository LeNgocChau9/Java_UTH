package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.application.dto.RepoCoverageDto;
import com.example.livingdocs_backend.application.dto.WeeklyTrendBucket;
import com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardStatsQueryAdapter implements DashboardStatsQueryPort {

    private static final String SCANNED_TYPES = "('CLASS', 'METHOD', 'FUNCTION')";
    private static final String DOCUMENTED_STATUSES = "('DOCUMENTED', 'DRIFTED')";

    private final EntityManager entityManager;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Override
    public long countScannedClassesAndFunctions(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES,
                "SELECT COUNT(*) FROM code_entities ce JOIN repositories r ON r.repository_id = ce.repository_id "
                        + "WHERE r.workspace_id = :workspaceId AND UPPER(ce.entity_type) IN " + SCANNED_TYPES,
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES
                        + " AND repository_id = :repositoryId",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countDocumentedEntities(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES
                        + " AND UPPER(doc_status) IN " + DOCUMENTED_STATUSES,
                "SELECT COUNT(*) FROM code_entities ce JOIN repositories r ON r.repository_id = ce.repository_id "
                        + "WHERE r.workspace_id = :workspaceId AND UPPER(ce.entity_type) IN " + SCANNED_TYPES
                        + " AND UPPER(ce.doc_status) IN " + DOCUMENTED_STATUSES,
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES
                        + " AND UPPER(doc_status) IN " + DOCUMENTED_STATUSES
                        + " AND repository_id = :repositoryId",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countDocuments(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM documents",
                "SELECT COUNT(*) FROM documents d JOIN repositories r ON r.repository_id = d.repo_id WHERE r.workspace_id = :workspaceId",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countApprovedDocuments(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM documents WHERE UPPER(status) = 'PUBLISHED'",
                "SELECT COUNT(*) FROM documents d JOIN repositories r ON r.repository_id = d.repo_id WHERE r.workspace_id = :workspaceId AND UPPER(d.status) = 'PUBLISHED'",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND UPPER(status) = 'PUBLISHED'",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countPendingReviewDocuments(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM documents WHERE UPPER(status) IN ('UNDER_REVIEW_STAFF', 'UNDER_REVIEW_MANAGER')",
                "SELECT COUNT(*) FROM documents d JOIN repositories r ON r.repository_id = d.repo_id WHERE r.workspace_id = :workspaceId AND UPPER(d.status) IN ('UNDER_REVIEW_STAFF', 'UNDER_REVIEW_MANAGER')",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND UPPER(status) IN ('UNDER_REVIEW_STAFF', 'UNDER_REVIEW_MANAGER')",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countDraftDocuments(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM documents WHERE UPPER(status) = 'DRAFT'",
                "SELECT COUNT(*) FROM documents d JOIN repositories r ON r.repository_id = d.repo_id WHERE r.workspace_id = :workspaceId AND UPPER(d.status) = 'DRAFT'",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND UPPER(status) = 'DRAFT'",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countTotalPullRequests(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        return countScoped(
                "SELECT COUNT(*) FROM pull_requests",
                "SELECT COUNT(*) FROM pull_requests pr JOIN repositories r ON r.repository_id = pr.repository_id WHERE r.workspace_id = :workspaceId",
                "SELECT COUNT(*) FROM pull_requests WHERE repository_id = :repositoryId",
                repositoryId,
                wsId
        );
    }

    @Override
    public long countTotalRepositories() {
        if (isUnassigned()) return 0L;
        Long wsId = currentWorkspaceFilter();
        String sql = wsId != null
                ? "SELECT COUNT(*) FROM repositories WHERE is_active = true AND workspace_id = :workspaceId"
                : "SELECT COUNT(*) FROM repositories WHERE is_active = true";
        Query query = entityManager.createNativeQuery(sql);
        if (wsId != null) {
            query.setParameter("workspaceId", wsId);
        }
        Object result = query.getSingleResult();
        return result instanceof Number number ? number.longValue() : 0L;
    }

    @Override
    public List<RepoCoverageDto> findRepoCoverages() {
        if (isUnassigned()) return Collections.emptyList();
        Long wsId = currentWorkspaceFilter();
        String workspaceClause = wsId != null ? " AND r.workspace_id = :workspaceId " : "";
        String sql = """
            SELECT
                r.repository_id,
                COALESCE(r.repo_full_name, r.repo_name),
                COALESCE(ce.total_entities, 0),
                COALESCE(ce.doc_entities, 0),
                COALESCE(al.open_alerts, 0)
            FROM repositories r
            LEFT JOIN (
                SELECT repository_id,
                       COUNT(*) AS total_entities,
                       COUNT(*) FILTER (WHERE UPPER(doc_status) IN ('DOCUMENTED', 'DRIFTED')) AS doc_entities
                FROM code_entities
                GROUP BY repository_id
            ) ce ON r.repository_id = ce.repository_id
            LEFT JOIN (
                SELECT repository_id, COUNT(*) AS open_alerts
                FROM document_change_alerts
                WHERE UPPER(status) = 'OPEN'
                GROUP BY repository_id
            ) al ON r.repository_id = al.repository_id
            WHERE r.is_active = true
            """ + workspaceClause + """
            ORDER BY r.repository_id
        """;

        Query query = entityManager.createNativeQuery(sql);
        if (wsId != null) {
            query.setParameter("workspaceId", wsId);
        }
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        List<RepoCoverageDto> list = new ArrayList<>();

        for (Object[] row : rows) {
            long repoId = row[0] instanceof Number n ? n.longValue() : 0L;
            String repoName = row[1] != null ? row[1].toString() : "repo-" + repoId;
            long totalEnt = row[2] instanceof Number n ? n.longValue() : 0L;
            long docEnt = row[3] instanceof Number n ? n.longValue() : 0L;
            long openAlerts = row[4] instanceof Number n ? n.longValue() : 0L;
            double cov = totalEnt > 0 ? Math.round(((double) docEnt / totalEnt) * 1000.0) / 10.0 : 0.0;

            list.add(RepoCoverageDto.builder()
                    .repoId(repoId)
                    .repoName(repoName)
                    .totalEntities(totalEnt)
                    .documentedEntities(docEnt)
                    .coveragePercent(cov)
                    .openDriftCount(openAlerts)
                    .build());
        }

        return list;
    }

    @Override
    public long countFreshDocuments(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return 0L;
        String freshPredicateDoc = """
                d.updated_at IS NOT NULL
                AND (d.updated_at AT TIME ZONE 'UTC') >= COALESCE(
                    (SELECT MAX(c.committed_at) FROM commits c WHERE c.repository_id = d.repo_id),
                    (d.updated_at AT TIME ZONE 'UTC')
                )
                """;
        return countScoped(
                "SELECT COUNT(*) FROM documents d WHERE " + freshPredicateDoc,
                "SELECT COUNT(*) FROM documents d JOIN repositories r ON r.repository_id = d.repo_id WHERE r.workspace_id = :workspaceId AND " + freshPredicateDoc,
                "SELECT COUNT(*) FROM documents d WHERE d.repo_id = :repositoryId AND " + freshPredicateDoc,
                repositoryId,
                wsId
        );
    }

    @Override
    public Optional<Instant> findLatestCommitAt(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return Optional.empty();
        String sql;
        if (repositoryId != null) {
            sql = "SELECT MAX(committed_at) FROM commits WHERE repository_id = :repositoryId";
        } else if (wsId != null) {
            sql = "SELECT MAX(c.committed_at) FROM commits c JOIN repositories r ON r.repository_id = c.repository_id WHERE r.workspace_id = :workspaceId";
        } else {
            sql = "SELECT MAX(committed_at) FROM commits";
        }
        Query query = entityManager.createNativeQuery(sql);
        bindFilters(query, repositoryId, wsId);
        return toInstant(query.getSingleResult());
    }

    @Override
    public Map<String, Long> countOpenAlertsBySeverity(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return Collections.emptyMap();
        String sql;
        if (repositoryId != null) {
            sql = """
                SELECT severity, COUNT(*)
                FROM document_change_alerts
                WHERE UPPER(status) = 'OPEN' AND repository_id = :repositoryId
                GROUP BY severity
                """;
        } else if (wsId != null) {
            sql = """
                SELECT a.severity, COUNT(*)
                FROM document_change_alerts a
                JOIN repositories r ON r.repository_id = a.repository_id
                WHERE UPPER(a.status) = 'OPEN' AND r.workspace_id = :workspaceId
                GROUP BY a.severity
                """;
        } else {
            sql = """
                SELECT severity, COUNT(*)
                FROM document_change_alerts
                WHERE UPPER(status) = 'OPEN'
                GROUP BY severity
                """;
        }
        Query query = entityManager.createNativeQuery(sql);
        bindFilters(query, repositoryId, wsId);
        Map<String, Long> counts = new LinkedHashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        for (Object[] row : rows) {
            String severity = row[0] == null ? null : row[0].toString();
            long value = row[1] instanceof Number number ? number.longValue() : 0L;
            counts.merge(severity, value, Long::sum);
        }
        return counts;
    }

    @Override
    public MissingDocEntityStatsDto countMissingEntitiesByType(Long repositoryId) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        Map<String, Long> byType = new LinkedHashMap<>();
        byType.put("CLASS", 0L);
        byType.put("METHOD", 0L);
        byType.put("FUNCTION", 0L);

        if (isUnassigned()) {
            return MissingDocEntityStatsDto.builder()
                    .totalMissing(0L)
                    .missingClasses(0L)
                    .missingMethodsAndFunctions(0L)
                    .missingByType(byType)
                    .build();
        }

        String sql;
        if (repositoryId != null) {
            sql = """
                SELECT UPPER(entity_type), COUNT(*)
                FROM code_entities
                WHERE UPPER(entity_type) IN ('CLASS', 'METHOD', 'FUNCTION')
                  AND (doc_status IS NULL OR UPPER(doc_status) NOT IN ('DOCUMENTED', 'DRIFTED'))
                  AND repository_id = :repositoryId
                GROUP BY UPPER(entity_type)
                """;
        } else if (wsId != null) {
            sql = """
                SELECT UPPER(ce.entity_type), COUNT(*)
                FROM code_entities ce
                JOIN repositories r ON r.repository_id = ce.repository_id
                WHERE r.workspace_id = :workspaceId
                  AND UPPER(ce.entity_type) IN ('CLASS', 'METHOD', 'FUNCTION')
                  AND (ce.doc_status IS NULL OR UPPER(ce.doc_status) NOT IN ('DOCUMENTED', 'DRIFTED'))
                GROUP BY UPPER(ce.entity_type)
                """;
        } else {
            sql = """
                SELECT UPPER(entity_type), COUNT(*)
                FROM code_entities
                WHERE UPPER(entity_type) IN ('CLASS', 'METHOD', 'FUNCTION')
                  AND (doc_status IS NULL OR UPPER(doc_status) NOT IN ('DOCUMENTED', 'DRIFTED'))
                GROUP BY UPPER(entity_type)
                """;
        }

        Query query = entityManager.createNativeQuery(sql);
        bindFilters(query, repositoryId, wsId);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        long totalMissing = 0L;
        long missingClasses = 0L;
        long missingMethodsAndFunctions = 0L;

        for (Object[] row : rows) {
            String type = row[0] != null ? row[0].toString().toUpperCase() : "UNKNOWN";
            long count = row[1] instanceof Number n ? n.longValue() : 0L;
            totalMissing += count;
            byType.put(type, count);
            if ("CLASS".equals(type)) {
                missingClasses += count;
            } else if ("METHOD".equals(type) || "FUNCTION".equals(type)) {
                missingMethodsAndFunctions += count;
            }
        }

        return MissingDocEntityStatsDto.builder()
                .totalMissing(totalMissing)
                .missingClasses(missingClasses)
                .missingMethodsAndFunctions(missingMethodsAndFunctions)
                .missingByType(byType)
                .build();
    }

    @Override
    public List<WeeklyTrendBucket> findWeeklyTrend(Long repositoryId, int weeks) {
        Long wsId = resolveWorkspaceFilter(repositoryId);
        if (isUnassigned()) return Collections.emptyList();
        boolean byRepo = repositoryId != null;
        boolean byWorkspace = !byRepo && wsId != null;
        Query query = entityManager.createNativeQuery(trendSql(byRepo, byWorkspace));
        query.setParameter("weekSpan", Math.max(weeks, 1) - 1);
        bindFilters(query, repositoryId, wsId);
        List<WeeklyTrendBucket> points = new ArrayList<>();
        for (Object rowObj : query.getResultList()) {
            Object[] row = (Object[]) rowObj;
            points.add(new WeeklyTrendBucket(
                    LocalDate.parse(row[0].toString()),
                    toLong(row[1]),
                    toLong(row[2]),
                    toLong(row[3]),
                    toLong(row[4]),
                    toDouble(row[5])
            ));
        }
        return points;
    }

    /**
     * Một round-trip: sinh dải tuần bằng generate_series, rồi GROUP BY date_trunc('week').
     * Tài liệu và phiên bản lưu timestamp không múi giờ theo UTC. Cảnh báo là timestamptz.
     */
    private static String trendSql(boolean byRepository, boolean byWorkspace) {
        String documentFilter;
        String alertFilter;
        String entityFilter;
        String linkFilter;
        if (byRepository) {
            documentFilter = " AND d.repo_id = :repositoryId";
            alertFilter = " AND a.repository_id = :repositoryId";
            entityFilter = " AND e.repository_id = :repositoryId";
            linkFilter = " AND EXISTS (SELECT 1 FROM documents d WHERE d.doc_id = l.document_id AND d.repo_id = :repositoryId)";
        } else if (byWorkspace) {
            documentFilter = " AND EXISTS (SELECT 1 FROM repositories r WHERE r.repository_id = d.repo_id AND r.workspace_id = :workspaceId)";
            alertFilter = " AND EXISTS (SELECT 1 FROM repositories r WHERE r.repository_id = a.repository_id AND r.workspace_id = :workspaceId)";
            entityFilter = " AND EXISTS (SELECT 1 FROM repositories r WHERE r.repository_id = e.repository_id AND r.workspace_id = :workspaceId)";
            linkFilter = " AND EXISTS (SELECT 1 FROM documents d JOIN repositories r ON r.repository_id = d.repo_id WHERE d.doc_id = l.document_id AND r.workspace_id = :workspaceId)";
        } else {
            documentFilter = "";
            alertFilter = "";
            entityFilter = "";
            linkFilter = "";
        }
        return """
                WITH bounds AS (
                    SELECT date_trunc('week', timezone('UTC', now())) AS this_week
                ),
                weeks AS (
                    SELECT generate_series(
                        (SELECT this_week FROM bounds) - (:weekSpan * INTERVAL '1 week'),
                        (SELECT this_week FROM bounds),
                        INTERVAL '1 week'
                    ) AS week_start
                ),
                created AS (
                    SELECT date_trunc('week', d.created_at) AS week_start, COUNT(*) AS cnt
                    FROM documents d
                    WHERE d.created_at IS NOT NULL
                      AND d.created_at >= (SELECT this_week FROM bounds) - (:weekSpan * INTERVAL '1 week')
                      %s
                    GROUP BY 1
                ),
                updates AS (
                    SELECT date_trunc('week', v.created_at) AS week_start, COUNT(*) AS cnt
                    FROM document_versions v
                    JOIN documents d ON d.doc_id = v.doc_id
                    WHERE v.created_at IS NOT NULL
                      AND v.version_num > 1
                      AND v.created_at >= (SELECT this_week FROM bounds) - (:weekSpan * INTERVAL '1 week')
                      %s
                    GROUP BY 1
                ),
                alerts AS (
                    SELECT date_trunc('week', a.created_at AT TIME ZONE 'UTC') AS week_start, COUNT(*) AS cnt
                    FROM document_change_alerts a
                    WHERE a.created_at >= ((SELECT this_week FROM bounds) - (:weekSpan * INTERVAL '1 week')) AT TIME ZONE 'UTC'
                      %s
                    GROUP BY 1
                ),
                approved AS (
                    SELECT date_trunc('week', d.updated_at AT TIME ZONE 'UTC') AS week_start, COUNT(*) AS cnt
                    FROM documents d
                    WHERE d.status IN ('APPROVED', 'PUBLISHED')
                      AND d.updated_at IS NOT NULL
                      AND d.updated_at >= ((SELECT this_week FROM bounds) - (:weekSpan * INTERVAL '1 week')) AT TIME ZONE 'UTC'
                      %s
                    GROUP BY 1
                ),
                coverage AS (
                    SELECT w.week_start,
                           CASE
                               WHEN COALESCE(ent.total, 0) = 0 THEN 0
                               ELSE ROUND(LEAST(COALESCE(cov.covered, 0), ent.total)::numeric * 100.0 / ent.total, 2)
                           END AS rate
                    FROM weeks w
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) AS total
                        FROM code_entities e
                        WHERE COALESCE(e.created_at, TIMESTAMP '1970-01-01') < w.week_start + INTERVAL '1 week'
                          %s
                    ) ent ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT COUNT(DISTINCT l.entity_id) AS covered
                        FROM doc_code_links l
                        WHERE l.entity_id IS NOT NULL
                          AND COALESCE(l.created_at, TIMESTAMP '1970-01-01') < w.week_start + INTERVAL '1 week'
                          %s
                    ) cov ON TRUE
                )
                SELECT to_char(w.week_start, 'YYYY-MM-DD'),
                       COALESCE(c.cnt, 0),
                       COALESCE(u.cnt, 0),
                       COALESCE(al.cnt, 0),
                       COALESCE(ap.cnt, 0),
                       COALESCE(cv.rate, 0)
                FROM weeks w
                LEFT JOIN created c ON c.week_start = w.week_start
                LEFT JOIN updates u ON u.week_start = w.week_start
                LEFT JOIN alerts al ON al.week_start = w.week_start
                LEFT JOIN approved ap ON ap.week_start = w.week_start
                LEFT JOIN coverage cv ON cv.week_start = w.week_start
                ORDER BY w.week_start
                """.formatted(documentFilter, documentFilter, alertFilter, documentFilter, entityFilter, linkFilter);
    }

    private boolean isUnassigned() {
        return tenantAccessService != null && tenantAccessService.currentScope().unassigned();
    }

    private Long currentWorkspaceFilter() {
        if (tenantAccessService == null) {
            return null;
        }
        var scope = tenantAccessService.currentScope();
        return scope.hasTenantFilter() ? scope.workspaceId() : null;
    }

    private Long resolveWorkspaceFilter(Long repositoryId) {
        if (tenantAccessService == null) {
            return null;
        }
        if (repositoryId != null) {
            tenantAccessService.requireRepositoryAccess(repositoryId);
            return null;
        }
        var scope = tenantAccessService.currentScope();
        return scope.hasTenantFilter() ? scope.workspaceId() : null;
    }

    private long countScoped(String sqlAll, String sqlByWorkspace, String sqlByRepository,
                             Long repositoryId, Long workspaceId) {
        String sql;
        if (repositoryId != null) {
            sql = sqlByRepository;
        } else if (workspaceId != null) {
            sql = sqlByWorkspace;
        } else {
            sql = sqlAll;
        }
        Query query = entityManager.createNativeQuery(sql);
        bindFilters(query, repositoryId, workspaceId);
        Object result = query.getSingleResult();
        return result instanceof Number number ? number.longValue() : 0L;
    }

    private static void bindFilters(Query query, Long repositoryId, Long workspaceId) {
        if (repositoryId != null) {
            query.setParameter("repositoryId", repositoryId);
        } else if (workspaceId != null) {
            query.setParameter("workspaceId", workspaceId);
        }
    }

    private static double toDouble(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0.0;
    }

    private static long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static Optional<Instant> toInstant(Object value) {
        if (value == null) {
            return Optional.empty();
        }
        if (value instanceof Instant instant) {
            return Optional.of(instant);
        }
        if (value instanceof Timestamp timestamp) {
            return Optional.of(timestamp.toInstant());
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return Optional.of(offsetDateTime.toInstant());
        }
        if (value instanceof LocalDateTime localDateTime) {
            return Optional.of(localDateTime.toInstant(ZoneOffset.UTC));
        }
        return Optional.empty();
    }
}
