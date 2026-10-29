package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.DashboardStatsResponse;
import com.example.livingdocs_backend.application.dto.DashboardTrendPoint;
import com.example.livingdocs_backend.application.dto.DashboardTrendResponse;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardStatsService {

    public static final int DEFAULT_TREND_WEEKS = 12;
    public static final int MAX_TREND_WEEKS = 52;

    static final List<String> STANDARD_SEVERITIES = List.of("LOW", "MEDIUM", "HIGH", "CRITICAL");

    private final DashboardStatsQueryPort queryPort;

    @Transactional(readOnly = true)
    public DashboardStatsResponse getStats(Long repositoryId) {
        long scanned = queryPort.countScannedClassesAndFunctions(repositoryId);
        long documented = queryPort.countDocumentedEntities(repositoryId);
        long documents = queryPort.countDocuments(repositoryId);
        long fresh = queryPort.countFreshDocuments(repositoryId);
        Map<String, Long> alerts = groupAlerts(queryPort.countOpenAlertsBySeverity(repositoryId));

        return DashboardStatsResponse.builder()
                .repositoryId(repositoryId)
                .totalClassesAndFunctions(scanned)
                .documentedEntities(documented)
                .coveragePercent(percent(documented, scanned))
                .freshnessPercent(percent(fresh, documents))
                .latestCommitAt(queryPort.findLatestCommitAt(repositoryId).orElse(null))
                .totalDocuments(documents)
                .freshDocuments(fresh)
                .openDriftAlerts(alerts.values().stream().mapToLong(Long::longValue).sum())
                .openAlertsBySeverity(alerts)
                .build();
    }

    @Transactional(readOnly = true)
    public DashboardTrendResponse getTrend(Long repositoryId, int weeks) {
        if (weeks < 1 || weeks > MAX_TREND_WEEKS) {
            throw new IllegalArgumentException("weeks phải từ 1 đến " + MAX_TREND_WEEKS);
        }
        List<DashboardTrendPoint> points = queryPort.findWeeklyTrend(repositoryId, weeks).stream()
                .map(bucket -> DashboardTrendPoint.builder()
                        .weekStart(bucket.weekStart())
                        .createdDocuments(bucket.createdDocuments())
                        .updates(bucket.updates())
                        .alerts(bucket.alerts())
                        .build())
                .toList();
        return DashboardTrendResponse.builder()
                .repositoryId(repositoryId)
                .weeks(weeks)
                .points(points)
                .build();
    }

    public static double percent(long numerator, long denominator) {
        if (denominator <= 0 || numerator <= 0) {
            return 0.0;
        }
        long capped = Math.min(numerator, denominator);
        return BigDecimal.valueOf(capped)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    public static Map<String, Long> groupAlerts(Map<String, Long> raw) {
        Map<String, Long> grouped = new LinkedHashMap<>();
        for (String severity : STANDARD_SEVERITIES) {
            grouped.put(severity, 0L);
        }
        if (raw == null) {
            return grouped;
        }
        raw.forEach((severity, count) -> {
            if (count == null || count <= 0) {
                return;
            }
            String key = severity == null || severity.isBlank()
                    ? "UNKNOWN"
                    : severity.trim().toUpperCase(Locale.ROOT);
            grouped.merge(key, count, Long::sum);
        });
        return grouped;
    }
}
