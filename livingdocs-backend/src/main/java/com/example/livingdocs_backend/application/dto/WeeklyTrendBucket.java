package com.example.livingdocs_backend.application.dto;

import java.time.LocalDate;

/**
 * Một tuần đã gom từ PostgreSQL. weekStart là thứ Hai theo UTC.
 */
public record WeeklyTrendBucket(
        LocalDate weekStart,
        long createdDocuments,
        long updates,
        long alerts
) {
}
