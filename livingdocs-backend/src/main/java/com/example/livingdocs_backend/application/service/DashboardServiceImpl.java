package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.WeeklyTrendBucket;
import com.example.livingdocs_backend.application.dto.dashboard.DashboardStatsDto;
import com.example.livingdocs_backend.application.dto.dashboard.DashboardTrendItemDto;
import com.example.livingdocs_backend.application.port.DashboardServicePort;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.infrastructure.persistence.entity.*;
import com.example.livingdocs_backend.infrastructure.persistence.repository.*;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardServicePort {

    private final SpringDataCodeEntityRepository codeEntityRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final SpringDataDocumentVersionRepository versionRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataPullRequestRepository pullRequestRepository;
    private final JpaDriftAlertRepository driftAlertRepository;
    private final DashboardStatsQueryPort dashboardStatsQueryPort;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsDto getDashboardStats() {
        TenantAccessService.TenantScope scope = tenantAccessService != null
                ? tenantAccessService.currentScope()
                : new TenantAccessService.TenantScope(true, false, false, null, false, null);

        if (scope.unassigned()) {
            return DashboardStatsDto.builder()
                    .coveragePercent(0.0)
                    .freshnessPercent(0.0)
                    .unresolvedDriftCount(0L)
                    .criticalDriftCount(0L)
                    .totalDocuments(0L)
                    .approvedDocuments(0L)
                    .pendingReviewDocuments(0L)
                    .draftDocuments(0L)
                    .totalPullRequests(0L)
                    .totalRepositories(0L)
                    .repoCoverages(Collections.emptyList())
                    .build();
        }

        boolean scoped = scope.hasTenantFilter();
        List<RepositoryEntity> repos = scoped
                ? repositoryRepository.findByWorkspaceId(scope.workspaceId())
                : repositoryRepository.findAll();
        Set<Long> allowedRepoIds = repos.stream()
                .map(RepositoryEntity::getRepositoryId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 1. Thống kê Code Entities & Coverage
        List<CodeEntityJpaEntity> allEntities = codeEntityRepository.findAll().stream()
                .filter(e -> !scoped || (e.getRepositoryId() != null && allowedRepoIds.contains(e.getRepositoryId())))
                .toList();
        long totalEntities = allEntities.size();
        long documentedEntities = allEntities.stream()
                .filter(e -> "DOCUMENTED".equalsIgnoreCase(e.getDocStatus()) || "DRIFTED".equalsIgnoreCase(e.getDocStatus()))
                .count();

        double coveragePercent = totalEntities > 0
                ? Math.round(((double) documentedEntities / totalEntities) * 1000.0) / 10.0
                : 0.0;

        // 2. Thống kê Tài liệu (Documents) & Freshness
        List<DocumentEntity> allDocs = scoped
                ? documentRepository.findByWorkspaceId(scope.workspaceId())
                : documentRepository.findAll();
        Set<Long> allowedDocIds = allDocs.stream()
                .map(DocumentEntity::getDocId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        long totalDocs = allDocs.size();
        long approvedCount = allDocs.stream()
                .filter(d -> d.getStatus() == DocumentStatus.APPROVED || d.getStatus() == DocumentStatus.PUBLISHED)
                .count();
        long pendingReviewCount = allDocs.stream()
                .filter(d -> d.getStatus() == DocumentStatus.UNDER_REVIEW_STAFF || d.getStatus() == DocumentStatus.UNDER_REVIEW_MANAGER)
                .count();
        long draftCount = allDocs.stream()
                .filter(d -> d.getStatus() == DocumentStatus.DRAFT)
                .count();

        Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);
        List<DocumentVersionEntity> allVersions = versionRepository.findAll().stream()
                .filter(v -> !scoped || (v.getDocId() != null && allowedDocIds.contains(v.getDocId())))
                .toList();
        long freshVersions = allVersions.stream()
                .filter(v -> v.getCreatedAt() != null && v.getCreatedAt().isAfter(thirtyDaysAgo))
                .count();

        double freshnessPercent = (!allVersions.isEmpty() && totalDocs > 0)
                ? Math.min(100.0, Math.round(((double) freshVersions / totalDocs) * 1000.0) / 10.0)
                : 0.0;

        // 3. Thống kê Cảnh báo sai lệch (Drift Alerts)
        List<DriftAlertEntity> allAlerts = driftAlertRepository.findAll().stream()
                .filter(a -> !scoped || (a.getRepoId() != null && allowedRepoIds.contains(a.getRepoId())))
                .toList();
        long openAlerts = allAlerts.stream()
                .filter(a -> "OPEN".equalsIgnoreCase(a.getStatus()))
                .count();
        long criticalAlerts = allAlerts.stream()
                .filter(a -> "OPEN".equalsIgnoreCase(a.getStatus()) && "CRITICAL".equalsIgnoreCase(a.getSeverity()))
                .count();

        // 4. Thống kê Repositories & PRs
        long totalRepos = repos.size();
        long totalPrs = scoped
                ? dashboardStatsQueryPort.countTotalPullRequests(null)
                : pullRequestRepository.count();

        // 5. Thống kê độ phủ chi tiết từng kho lưu trữ
        List<DashboardStatsDto.RepoCoverageDto> repoCoverages = new ArrayList<>();
        for (RepositoryEntity repo : repos) {
            long repoEntitiesCount = allEntities.stream()
                    .filter(e -> repo.getRepositoryId().equals(e.getRepositoryId()))
                    .count();
            long repoDocCount = allEntities.stream()
                    .filter(e -> repo.getRepositoryId().equals(e.getRepositoryId())
                            && ("DOCUMENTED".equalsIgnoreCase(e.getDocStatus()) || "DRIFTED".equalsIgnoreCase(e.getDocStatus())))
                    .count();
            long repoOpenAlerts = allAlerts.stream()
                    .filter(a -> repo.getRepositoryId().equals(a.getRepoId()) && "OPEN".equalsIgnoreCase(a.getStatus()))
                    .count();

            double repoCov = repoEntitiesCount > 0
                    ? Math.round(((double) repoDocCount / repoEntitiesCount) * 1000.0) / 10.0
                    : 0.0;

            repoCoverages.add(DashboardStatsDto.RepoCoverageDto.builder()
                    .repoId(repo.getRepositoryId())
                    .repoName(repo.getRepoFullName())
                    .coveragePercent(repoCov)
                    .totalEntities(repoEntitiesCount)
                    .documentedEntities(repoDocCount)
                    .openDriftCount(repoOpenAlerts)
                    .build());
        }

        return DashboardStatsDto.builder()
                .coveragePercent(coveragePercent)
                .freshnessPercent(freshnessPercent)
                .unresolvedDriftCount(openAlerts)
                .criticalDriftCount(criticalAlerts)
                .totalDocuments(totalDocs)
                .approvedDocuments(approvedCount)
                .pendingReviewDocuments(pendingReviewCount)
                .draftDocuments(draftCount)
                .totalPullRequests(totalPrs)
                .totalRepositories(totalRepos)
                .repoCoverages(repoCoverages)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DashboardTrendItemDto> getUpdateTrend() {
        if (tenantAccessService != null && tenantAccessService.currentScope().unassigned()) {
            return Collections.emptyList();
        }
        List<WeeklyTrendBucket> buckets = dashboardStatsQueryPort.findWeeklyTrend(null, 4);
        DateTimeFormatter day = DateTimeFormatter.ofPattern("dd/MM");
        List<DashboardTrendItemDto> items = new ArrayList<>();
        for (int i = 0; i < buckets.size(); i++) {
            WeeklyTrendBucket bucket = buckets.get(i);
            LocalDate start = bucket.weekStart();
            boolean current = i == buckets.size() - 1;
            items.add(DashboardTrendItemDto.builder()
                    .label(current ? "Tuần " + (i + 1) + " (Hiện tại)" : "Tuần " + (i + 1))
                    .period(day.format(start) + " - " + day.format(start.plusDays(6)))
                    .updatedDocs((int) (bucket.createdDocuments() + bucket.updates()))
                    .driftAlerts((int) bucket.alerts())
                    .coverageRate(bucket.coveragePercent())
                    .build());
        }
        return items;
    }
}
