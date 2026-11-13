package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAlertSummaryResponse {
    private long pendingCount;
    private List<DriftAlertNotificationDto> recentAlerts;
}
