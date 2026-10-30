package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DashboardStatsResponse;
import com.example.livingdocs_backend.application.dto.DashboardTrendResponse;
import com.example.livingdocs_backend.application.dto.WeeklyTrendBucket;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import com.example.livingdocs_backend.application.service.DashboardStatsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DashboardStatsServiceTest {

    private DashboardStatsQueryPort queryPort;
    private DashboardStatsService service;

    @BeforeEach
    void setUp() {
        queryPort = mock(DashboardStatsQueryPort.class);
        service = new DashboardStatsService(queryPort);
    }

    @Test
    @DisplayName("coverage, freshness và cảnh báo OPEN được tính đúng")
    void aggregatesCoverageFreshnessAndAlerts() {
        Instant latest = Instant.parse("2026-10-29T10:00:00Z");
        when(queryPort.countScannedClassesAndFunctions(null)).thenReturn(8L);
        when(queryPort.countDocumentedEntities(null)).thenReturn(6L);
        when(queryPort.countDocuments(null)).thenReturn(4L);
        when(queryPort.countFreshDocuments(null)).thenReturn(1L);
        when(queryPort.findLatestCommitAt(null)).thenReturn(Optional.of(latest));
        when(queryPort.countOpenAlertsBySeverity(null)).thenReturn(Map.of(
                "high", 2L,
                "MEDIUM", 1L,
                "info", 4L
        ));

        DashboardStatsResponse stats = service.getStats(null);

        assertEquals(8L, stats.getTotalClassesAndFunctions());
        assertEquals(6L, stats.getDocumentedEntities());
        assertEquals(75.0, stats.getCoveragePercent());
        assertEquals(25.0, stats.getFreshnessPercent());
        assertEquals(latest, stats.getLatestCommitAt());
        assertEquals(4L, stats.getTotalDocuments());
        assertEquals(1L, stats.getFreshDocuments());
        assertEquals(7L, stats.getOpenDriftAlerts());
        assertEquals(0L, stats.getOpenAlertsBySeverity().get("LOW"));
        assertEquals(1L, stats.getOpenAlertsBySeverity().get("MEDIUM"));
        assertEquals(2L, stats.getOpenAlertsBySeverity().get("HIGH"));
        assertEquals(0L, stats.getOpenAlertsBySeverity().get("CRITICAL"));
        assertEquals(4L, stats.getOpenAlertsBySeverity().get("INFO"));
    }

    @Test
    @DisplayName("chưa có dữ liệu thì coverage và freshness bằng 0")
    void emptyScopeReturnsZeroPercents() {
        when(queryPort.countScannedClassesAndFunctions(3L)).thenReturn(0L);
        when(queryPort.countDocumentedEntities(3L)).thenReturn(0L);
        when(queryPort.countDocuments(3L)).thenReturn(0L);
        when(queryPort.countFreshDocuments(3L)).thenReturn(0L);
        when(queryPort.findLatestCommitAt(3L)).thenReturn(Optional.empty());
        when(queryPort.countOpenAlertsBySeverity(3L)).thenReturn(Map.of());

        DashboardStatsResponse stats = service.getStats(3L);

        assertEquals(3L, stats.getRepositoryId());
        assertEquals(0.0, stats.getCoveragePercent());
        assertEquals(0.0, stats.getFreshnessPercent());
        assertEquals(0L, stats.getOpenDriftAlerts());
        verify(queryPort).countScannedClassesAndFunctions(3L);
    }

    @Test
    @DisplayName("làm tròn nửa lên tới 2 chữ số thập phân")
    void roundsPercentHalfUp() {
        assertEquals(33.33, DashboardStatsService.percent(1, 3));
        assertEquals(66.67, DashboardStatsService.percent(2, 3));
        assertEquals(0.0, DashboardStatsService.percent(0, 5));
        assertEquals(0.0, DashboardStatsService.percent(1, 0));
    }

    @Test
    @DisplayName("repositoryId được truyền xuống mọi truy vấn")
    void forwardsRepositoryIdToEveryQuery() {
        when(queryPort.countScannedClassesAndFunctions(9L)).thenReturn(2L);
        when(queryPort.countDocumentedEntities(9L)).thenReturn(2L);
        when(queryPort.countDocuments(9L)).thenReturn(1L);
        when(queryPort.countFreshDocuments(9L)).thenReturn(1L);
        when(queryPort.findLatestCommitAt(9L)).thenReturn(Optional.empty());
        when(queryPort.countOpenAlertsBySeverity(9L)).thenReturn(Map.of("LOW", 1L));

        DashboardStatsResponse stats = service.getStats(9L);

        assertEquals(100.0, stats.getCoveragePercent());
        assertEquals(100.0, stats.getFreshnessPercent());
        assertEquals(1L, stats.getOpenDriftAlerts());
        verify(queryPort).countScannedClassesAndFunctions(9L);
        verify(queryPort).countDocumentedEntities(9L);
        verify(queryPort).countDocuments(9L);
        verify(queryPort).countFreshDocuments(9L);
        verify(queryPort).findLatestCommitAt(9L);
        verify(queryPort).countOpenAlertsBySeverity(9L);
    }

    @Test
    @DisplayName("tử số lớn hơn mẫu số thì phần trăm không vượt 100")
    void percentNeverExceedsOneHundred() {
        assertEquals(100.0, DashboardStatsService.percent(5, 5));
        assertEquals(100.0, DashboardStatsService.percent(8, 5));
    }

    @Test
    @DisplayName("gộp mức độ viết thường và bỏ count không dương")
    void groupsSeverityCaseInsensitively() {
        Map<String, Long> raw = new LinkedHashMap<>();
        raw.put(" low ", 1L);
        raw.put("LOW", 2L);
        raw.put(null, 3L);
        raw.put("HIGH", 0L);

        Map<String, Long> grouped = DashboardStatsService.groupAlerts(raw);

        assertEquals(3L, grouped.get("LOW"));
        assertEquals(0L, grouped.get("HIGH"));
        assertEquals(3L, grouped.get("UNKNOWN"));
    }

    @Test
    @DisplayName("xu hướng giữ đúng thứ tự tuần và số liệu")
    void mapsWeeklyTrendInOrder() {
        LocalDate older = LocalDate.of(2026, 10, 19);
        LocalDate newer = LocalDate.of(2026, 10, 26);
        when(queryPort.findWeeklyTrend(1L, 2)).thenReturn(List.of(
                new WeeklyTrendBucket(older, 1, 0, 0),
                new WeeklyTrendBucket(newer, 2, 3, 4)
        ));

        DashboardTrendResponse trend = service.getTrend(1L, 2);

        assertEquals(1L, trend.getRepositoryId());
        assertEquals(2, trend.getWeeks());
        assertEquals(older, trend.getPoints().get(0).getWeekStart());
        assertEquals(0L, trend.getPoints().get(0).getUpdates());
        assertEquals(2L, trend.getPoints().get(1).getCreatedDocuments());
        assertEquals(3L, trend.getPoints().get(1).getUpdates());
        assertEquals(4L, trend.getPoints().get(1).getAlerts());
        verify(queryPort).findWeeklyTrend(1L, 2);
    }

    @Test
    @DisplayName("số tuần ngoài 1..52 bị từ chối")
    void rejectsTrendWeekRange() {
        assertThrows(IllegalArgumentException.class, () -> service.getTrend(null, 0));
        assertThrows(IllegalArgumentException.class, () -> service.getTrend(null, 53));
    }
}
