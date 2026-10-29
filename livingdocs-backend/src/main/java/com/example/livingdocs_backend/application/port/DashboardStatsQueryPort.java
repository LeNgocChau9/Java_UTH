package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.WeeklyTrendBucket;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Đọc số liệu thô cho dashboard sức khỏe tài liệu.
 * {@code repositoryId} null nghĩa là toàn bộ hệ thống.
 */
public interface DashboardStatsQueryPort {

    long countScannedClassesAndFunctions(Long repositoryId);

    long countDocumentedEntities(Long repositoryId);

    long countDocuments(Long repositoryId);

    long countFreshDocuments(Long repositoryId);

    Optional<Instant> findLatestCommitAt(Long repositoryId);

    Map<String, Long> countOpenAlertsBySeverity(Long repositoryId);

    /**
     * Chuỗi tuần liên tục, tuần cũ đứng trước. Tuần không có dữ liệu vẫn có mặt với số 0.
     */
    List<WeeklyTrendBucket> findWeeklyTrend(Long repositoryId, int weeks);
}
