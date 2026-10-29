package com.example.livingdocs_backend.application.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDto {
    /** Tỷ lệ bao phủ tài liệu (% code entities đã được viết docs) */
    private Double coveragePercent;

    /** Độ tươi mới của tài liệu (% tài liệu cập nhật trong 30 ngày) */
    private Double freshnessPercent;

    /** Tổng số cảnh báo trôi dạt (Drift Alerts) đang mở (chưa xử lý) */
    private Long unresolvedDriftCount;

    /** Số cảnh báo mức Nghiêm trọng (CRITICAL) chưa xử lý */
    private Long criticalDriftCount;

    /** Tổng số tài liệu kỹ thuật trong hệ thống */
    private Long totalDocuments;

    /** Số tài liệu đã xuất bản (PUBLISHED) hoặc đã phê duyệt (APPROVED) */
    private Long approvedDocuments;

    /** Số tài liệu đang trong hàng đợi chờ xem xét / phê duyệt */
    private Long pendingReviewDocuments;

    /** Số bản nháp tài liệu (DRAFT) */
    private Long draftDocuments;

    /** Tổng số Pull Request đã đồng bộ */
    private Long totalPullRequests;

    /** Tổng số kho lưu trữ (Repositories) đang quản lý */
    private Long totalRepositories;

    /** Thống kê độ phủ chi tiết theo từng repository */
    private List<RepoCoverageDto> repoCoverages;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RepoCoverageDto {
        private Long repoId;
        private String repoName;
        private Double coveragePercent;
        private Long totalEntities;
        private Long documentedEntities;
        private Long openDriftCount;
    }
}

