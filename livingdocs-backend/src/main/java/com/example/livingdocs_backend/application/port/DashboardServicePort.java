package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.dashboard.DashboardStatsDto;
import com.example.livingdocs_backend.application.dto.dashboard.DashboardTrendItemDto;

import java.util.List;

public interface DashboardServicePort {
    /**
     * Lấy toàn bộ số liệu thống kê đo lường sức khỏe tài liệu
     */
    DashboardStatsDto getDashboardStats();

    /**
     * Lấy dữ liệu xu hướng cập nhật tài liệu qua các đợt PR / các tuần
     */
    List<DashboardTrendItemDto> getUpdateTrend();
}

