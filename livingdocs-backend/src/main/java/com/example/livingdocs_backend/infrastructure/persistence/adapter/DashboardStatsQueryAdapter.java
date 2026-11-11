package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.application.dto.WeeklyTrendBucket;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
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

    @Override
    public long countScannedClassesAndFunctions(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES,
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES
                        + " AND repository_id = :repositoryId",
                repositoryId
        );
    }

    @Override
    public long countDocumentedEntities(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES
                        + " AND UPPER(doc_status) IN " + DOCUMENTED_STATUSES,
                "SELECT COUNT(*) FROM code_entities WHERE UPPER(entity_type) IN " + SCANNED_TYPES
                        + " AND UPPER(doc_status) IN " + DOCUMENTED_STATUSES
                        + " AND repository_id = :repositoryId",
                repositoryId
        );
    }

    @Override
    public long countDocuments(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM documents",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId",
                repositoryId
        );
    }

    @Override
    public long countApprovedDocuments(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM documents WHERE UPPER(status) = 'PUBLISHED'",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND UPPER(status) = 'PUBLISHED'",
                repositoryId
        );
    }

    @Override
    public long countPendingReviewDocuments(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM documents WHERE UPPER(status) IN ('UNDER_REVIEW_STAFF', 'UNDER_REVIEW_MANAGER')",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND UPPER(status) IN ('UNDER_REVIEW_STAFF', 'UNDER_REVIEW_MANAGER')",
                repositoryId
        );
    }

    @Override
    public long countDraftDocuments(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM documents WHERE UPPER(status) = 'DRAFT'",
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND UPPER(status) = 'DRAFT'",
                repositoryId
        );
    }

    @Override
    public long countTotalPullRequests(Long repositoryId) {
        return count(
                "SELECT COUNT(*) FROM pull_requests",
                "SELECT COUNT(*) FROM pull_requests WHERE repository_id = :repositoryId",
                repositoryId
        );
    }

    @Override
    public long countTotalRepositories() {
        Query query = entityManager.createNativeQuery("SELECT COUNT(*) FROM repositories WHERE is_active = true");
        Object result = query.getSingleResult();
        return result instanceof Number number ? number.longValue() : 0L;
    }

    @Override
    public List<com.example.livingdocs_backend.application.dto.RepoCoverageDto> findRepoCoverages() {
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
            ORDER BY r.repository_id
        """;

        Query query = entityManager.createNativeQuery(sql);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        List<com.example.livingdocs_backend.application.dto.RepoCoverageDto> list = new ArrayList<>();

        for (Object[] row : rows) {
            long repoId = row[0] instanceof Number n ? n.longValue() : 0L;
            String repoName = row[1] != null ? row[1].toString() : "repo-" + repoId;
            long totalEnt = row[2] instanceof Number n ? n.longValue() : 0L;
            long docEnt = row[3] instanceof Number n ? n.longValue() : 0L;
            long openAlerts = row[4] instanceof Number n ? n.longValue() : 0L;
            double cov = totalEnt > 0 ? Math.round(((double) docEnt / totalEnt) * 1000.0) / 10.0 : 0.0;

            list.add(com.example.livingdocs_backend.application.dto.RepoCoverageDto.builder()
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
        String freshPredicate = """
                updated_at IS NOT NULL
                AND (updated_at AT TIME ZONE 'UTC') >= COALESCE(
                    (SELECT MAX(c.committed_at) FROM commits c WHERE c.repository_id = documents.repo_id),
                    (updated_at AT TIME ZONE 'UTC')
                )
                """;
        return count(
                "SELECT COUNT(*) FROM documents WHERE " + freshPredicate,
                "SELECT COUNT(*) FROM documents WHERE repo_id = :repositoryId AND " + freshPredicate,
                repositoryId
        );
    }

    @Override
    public Optional<Instant> findLatestCommitAt(Long repositoryId) {
        String sql = repositoryId == null
                ? "SELECT MAX(committed_at) FROM commits"
                : "SELECT MAX(committed_at) FROM commits WHERE repository_id = :repositoryId";
        Query query = entityManager.createNativeQuery(sql);
        bindRepository(query, repositoryId);
        return toInstant(query.getSingleResult());
    }

    @Override
    public Map<String, Long> countOpenAlertsBySeverity(Long repositoryId) {
        String sql = repositoryId == null
                ? """
                SELECT severity, COUNT(*)
                FROM document_change_alerts
                WHERE UPPER(status) = 'OPEN'
                GROUP BY severity
                """
                : """
                SELECT severity, COUNT(*)
                FROM document_change_alerts
                WHERE UPPER(status) = 'OPEN' AND repository_id = :repositoryId
                GROUP BY severity
                """;
        Query query = entityManager.createNativeQuery(sql);
        bindRepository(query, repositoryId);
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
    public com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto countMissingEntitiesByType(Long repositoryId) {
        String sql = repositoryId == null
                ? """
                SELECT UPPER(entity_type), COUNT(*)
                FROM code_entities
                WHERE UPPER(entity_type) IN ('CLASS', 'METHOD', 'FUNCTION')
                  AND (doc_status IS NULL OR UPPER(doc_status) NOT IN ('DOCUMENTED', 'DRIFTED'))
                GROUP BY UPPER(entity_type)
                """
                : """
                SELECT UPPER(entity_type), COUNT(*)
                FROM code_entities
                WHERE UPPER(entity_type) IN ('CLASS', 'METHOD', 'FUNCTION')
                  AND (doc_status IS NULL OR UPPER(doc_status) NOT IN ('DOCUMENTED', 'DRIFTED'))
                  AND repository_id = :repositoryId
                GROUP BY UPPER(entity_type)
                """;

        Query query = entityManager.createNativeQuery(sql);
        bindRepository(query, repositoryId);

        Map<String, Long> byType = new LinkedHashMap<>();
        byType.put("CLASS", 0L);
        byType.put("METHOD", 0L);
        byType.put("FUNCTION", 0L);

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

        return com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto.builder()
                .totalMissing(totalMissing)
                .missingClasses(missingClasses)
                .missingMethodsAndFunctions(missingMethodsAndFunctions)
                .missingByType(byType)
                .build();
    }

    @Override
    public List<WeeklyTrendBucket> findWeeklyTrend(Long repositoryId, int weeks) {
        Query query = entityManager.createNativeQuery(trendSql(repositoryId != null));
        query.setParameter("weekSpan", Math.max(weeks, 1) - 1);
        bindRepository(query, repositoryId);
        List<WeeklyTrendBucket> points = new ArrayList<>();
        for (Object rowObj : query.getResultList()) {
            Object[] row = (Object[]) rowObj;
            points.add(new WeeklyTrendBucket(
                    LocalDate.parse(row[0].toString()),
                    toLong(row[1]),
                    toLong(row[2]),
                    toLong(row[3])
            ));
        }
        return points;
    }

    /**
     * Một round-trip: sinh dải tuần bằng generate_series, rồi GROUP BY date_trunc('week').
     * Tài liệu và phiên bản lưu timestamp không múi giờ theo UTC. Cảnh báo là timestamptz.
     */
    private static String trendSql(boolean byRepository) {
        String documentFilter = byRepository ? " AND d.repo_id = :repositoryId" : "";
        String alertFilter = byRepository ? " AND a.repository_id = :repositoryId" : "";
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
                )
                SELECT to_char(w.week_start, 'YYYY-MM-DD'),
                       COALESCE(c.cnt, 0),
                       COALESCE(u.cnt, 0),
                       COALESCE(al.cnt, 0)
                FROM weeks w
                LEFT JOIN created c ON c.week_start = w.week_start
                LEFT JOIN updates u ON u.week_start = w.week_start
                LEFT JOIN alerts al ON al.week_start = w.week_start
                ORDER BY w.week_start
                """.formatted(documentFilter, documentFilter, alertFilter);
    }

    private static long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private long count(String sqlAll, String sqlByRepository, Long repositoryId) {
        Query query = entityManager.createNativeQuery(repositoryId == null ? sqlAll : sqlByRepository);
        bindRepository(query, repositoryId);
        Object result = query.getSingleResult();
        return result instanceof Number number ? number.longValue() : 0L;
    }

    private static void bindRepository(Query query, Long repositoryId) {
        if (repositoryId != null) {
            query.setParameter("repositoryId", repositoryId);
        }
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
