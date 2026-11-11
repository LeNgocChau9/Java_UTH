package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.RepoCoverageDto;
import com.example.livingdocs_backend.application.dto.health.DocumentHealthReportResponse;
import com.example.livingdocs_backend.application.dto.health.MissingDocEntityStatsDto;
import com.example.livingdocs_backend.application.dto.health.ProjectComplianceDto;
import com.example.livingdocs_backend.application.port.DashboardStatsQueryPort;
import com.example.livingdocs_backend.application.port.DocumentHealthReportServicePort;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentHealthReportServiceImpl implements DocumentHealthReportServicePort {

    private final DashboardStatsQueryPort queryPort;
    private final SpringDataRepositoryRepository repositoryRepository;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    @Override
    @Transactional(readOnly = true)
    public DocumentHealthReportResponse generateHealthReport(Long repositoryId) {
        long startTime = System.currentTimeMillis();

        String repoName = null;
        if (repositoryId != null) {
            repoName = repositoryRepository.findById(repositoryId)
                    .map(r -> r.getRepoFullName() != null ? r.getRepoFullName() : r.getRepoName())
                    .orElse(null);
        }

        // 1. Chỉ số quét và độ bao phủ
        long scanned = queryPort.countScannedClassesAndFunctions(repositoryId);
        long documented = queryPort.countDocumentedEntities(repositoryId);
        double coveragePercent = DashboardStatsService.percent(documented, scanned);

        // 2. Độ mới theo commit mới nhất
        long totalDocs = queryPort.countDocuments(repositoryId);
        long freshDocs = queryPort.countFreshDocuments(repositoryId);
        double freshnessPercent = DashboardStatsService.percent(freshDocs, totalDocs);
        Instant latestCommitAt = queryPort.findLatestCommitAt(repositoryId).orElse(null);

        // 3. Số lượng hàm và lớp còn thiếu tài liệu
        MissingDocEntityStatsDto missingStats = queryPort.countMissingEntitiesByType(repositoryId);

        // 4. Phân loại cảnh báo sai lệch (OPEN alerts)
        Map<String, Long> alertsBySeverity = DashboardStatsService.groupAlerts(queryPort.countOpenAlertsBySeverity(repositoryId));
        long totalOpenAlerts = alertsBySeverity.values().stream().mapToLong(Long::longValue).sum();

        // 5. Đánh giá mức độ tuân thủ
        ProjectComplianceDto compliance = evaluateCompliance(coveragePercent, freshnessPercent, alertsBySeverity);

        // 6. Chi tiết theo từng kho (nếu xem toàn hệ thống hoặc có repo con)
        List<RepoCoverageDto> repoCoverages = (repositoryId == null) ? queryPort.findRepoCoverages() : List.of();

        long executionTimeMs = System.currentTimeMillis() - startTime;
        log.info("Báo cáo sức khỏe tài liệu tạo thành công cho repositoryId={} trong {} ms", repositoryId, executionTimeMs);

        return DocumentHealthReportResponse.builder()
                .repositoryId(repositoryId)
                .repositoryName(repoName)
                .generatedAt(Instant.now())
                .executionTimeMs(executionTimeMs)
                .coveragePercent(coveragePercent)
                .totalScannedEntities(scanned)
                .documentedEntities(documented)
                .freshnessPercent(freshnessPercent)
                .latestCommitAt(latestCommitAt)
                .totalDocuments(totalDocs)
                .freshDocuments(freshDocs)
                .missingDocEntities(missingStats)
                .totalOpenDriftAlerts(totalOpenAlerts)
                .openAlertsBySeverity(alertsBySeverity)
                .compliance(compliance)
                .repositoryDetails(repoCoverages)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public String exportHealthReportMarkdown(Long repositoryId) {
        DocumentHealthReportResponse report = generateHealthReport(repositoryId);
        return renderMarkdownReport(report);
    }

    private ProjectComplianceDto evaluateCompliance(double coverage, double freshness, Map<String, Long> alerts) {
        long critical = alerts.getOrDefault("CRITICAL", 0L);
        long high = alerts.getOrDefault("HIGH", 0L);
        long medium = alerts.getOrDefault("MEDIUM", 0L);
        long low = alerts.getOrDefault("LOW", 0L);

        // Điểm kiểm soát sai lệch: Khởi điểm 100 điểm, trừ theo mức độ nghiêm trọng
        double penalty = (critical * 25.0) + (high * 10.0) + (medium * 4.0) + (low * 1.0);
        double driftControlScore = Math.max(0.0, 100.0 - penalty);

        // Điểm tổng thể: 40% Coverage + 35% Freshness + 25% Drift Control
        double overallScore = (coverage * 0.40) + (freshness * 0.35) + (driftControlScore * 0.25);
        overallScore = BigDecimal.valueOf(overallScore).setScale(1, RoundingMode.HALF_UP).doubleValue();

        String rating;
        if (overallScore >= 90.0 && critical == 0) {
            rating = "EXCELLENT (A+)";
        } else if (overallScore >= 80.0 && critical == 0) {
            rating = "GOOD (A)";
        } else if (overallScore >= 65.0) {
            rating = "MODERATE (B)";
        } else if (overallScore >= 50.0) {
            rating = "POOR (C)";
        } else {
            rating = "CRITICAL (D)";
        }

        List<String> recommendations = new ArrayList<>();
        if (critical > 0) {
            recommendations.add("Khẩn cấp xử lý " + critical + " cảnh báo trôi dạt nghiêm trọng (CRITICAL) để tránh sai lệch tài liệu thực tế.");
        }
        if (coverage < 70.0) {
            recommendations.add("Nâng cao tỷ lệ bao phủ tài liệu (hiện tại " + coverage + "%), ưu tiên viết tài liệu cho các lớp/hàm cốt lõi còn thiếu.");
        }
        if (freshness < 75.0) {
            recommendations.add("Cập nhật lại các tài liệu có ngày sửa đổi cũ hơn commit mới nhất (độ mới chỉ đạt " + freshness + "%).");
        }
        if (high > 0) {
            recommendations.add("Xem xét và giải quyết " + high + " cảnh báo sai lệch mức độ CAO (HIGH).");
        }
        if (recommendations.isEmpty()) {
            recommendations.add("Hệ thống tài liệu đang ở trạng thái rất tốt. Hãy tiếp tục duy trì cập nhật tài liệu khi commit code mới.");
        }

        String summary = String.format("Mức độ tuân thủ đạt %s với điểm số %.1f/100. Tỷ lệ bao phủ đạt %.1f%%, độ mới đạt %.1f%% và điểm kiểm soát sai lệch đạt %.1f%%.",
                rating, overallScore, coverage, freshness, driftControlScore);

        return ProjectComplianceDto.builder()
                .overallScore(overallScore)
                .rating(rating)
                .coverageScore(coverage)
                .freshnessScore(freshness)
                .driftControlScore(driftControlScore)
                .summary(summary)
                .recommendations(recommendations)
                .build();
    }

    private String renderMarkdownReport(DocumentHealthReportResponse r) {
        StringBuilder sb = new StringBuilder();
        String scopeTitle = r.getRepositoryName() != null ? "Kho lưu trữ: `" + r.getRepositoryName() + "`" : "Toàn bộ hệ thống";

        sb.append("# 📊 Báo Cáo Tình Trạng Sức Khỏe Tài Liệu (Document Health Report)\n\n");
        sb.append("> **Phạm vi:** ").append(scopeTitle).append("  \n");
        sb.append("> **Thời điểm xuất:** ").append(TIME_FORMATTER.format(r.getGeneratedAt())).append("  \n");
        sb.append("> **Thời gian xử lý:** `").append(r.getExecutionTimeMs()).append(" ms` (đáp ứng tiêu chuẩn < 300ms)\n\n");

        sb.append("---\n\n");

        // 1. Đánh giá mức độ tuân thủ
        ProjectComplianceDto c = r.getCompliance();
        sb.append("## 1. Đánh Giá Mức Độ Tuân Thủ (Compliance Evaluation)\n\n");
        sb.append("| Chỉ số | Điểm số / Xếp loại | Tiêu chuẩn đánh giá |\n");
        sb.append("| :--- | :--- | :--- |\n");
        sb.append(String.format("| **Điểm tuân thủ tổng thể** | **%.1f / 100** | Trọng số: 40%% Bao phủ + 35%% Độ mới + 25%% Kiểm soát trôi dạt |\n", c.getOverallScore()));
        sb.append(String.format("| **Xếp hạng chất lượng** | **`%s`** | Phân loại từ CRITICAL (D) đến EXCELLENT (A+) |\n", c.getRating()));
        sb.append(String.format("| Điểm bao phủ mã nguồn | %.1f / 100 | Tỷ lệ class, method đã có tài liệu |\n", c.getCoverageScore()));
        sb.append(String.format("| Điểm độ mới tài liệu | %.1f / 100 | Tỷ lệ tài liệu cập nhật theo commit mới nhất |\n", c.getFreshnessScore()));
        sb.append(String.format("| Điểm kiểm soát sai lệch | %.1f / 100 | Trừ điểm theo số lượng cảnh báo trôi dạt mở |\n\n", c.getDriftControlScore()));
        sb.append("**Nhận định chung:** ").append(c.getSummary()).append("\n\n");

        sb.append("### Khuyến nghị hành động:\n");
        for (String rec : c.getRecommendations()) {
            sb.append("- ").append(rec).append("\n");
        }
        sb.append("\n");

        // 2. Chỉ số bao phủ & độ mới
        sb.append("## 2. Chỉ Số Bao Phủ & Độ Mới Tài Liệu\n\n");
        sb.append("| Chỉ số sức khỏe | Giá trị thực tế | Chi tiết thống kê |\n");
        sb.append("| :--- | :--- | :--- |\n");
        sb.append(String.format("| **Tỷ lệ bao phủ mã nguồn** | **%.2f%%** | %d / %d thực thể đã được viết tài liệu |\n",
                r.getCoveragePercent(), r.getDocumentedEntities(), r.getTotalScannedEntities()));
        sb.append(String.format("| **Tỷ lệ độ mới theo commit** | **%.2f%%** | %d / %d tài liệu khớp với commit mới nhất |\n",
                r.getFreshnessPercent(), r.getFreshDocuments(), r.getTotalDocuments()));
        String commitStr = r.getLatestCommitAt() != null ? TIME_FORMATTER.format(r.getLatestCommitAt()) : "Chưa có commit";
        sb.append(String.format("| Commit code mới nhất | `%s` | Mốc so sánh tính toán độ mới |\n\n", commitStr));

        // 3. Số lượng hàm và lớp còn thiếu tài liệu
        MissingDocEntityStatsDto m = r.getMissingDocEntities();
        sb.append("## 3. Thống Kê Hàm & Lớp Còn Thiếu Tài Liệu\n\n");
        sb.append(String.format("- **Tổng số thực thể thiếu tài liệu:** **%d**\n", m.getTotalMissing()));
        sb.append(String.format("- **Lớp (Classes) còn thiếu:** %d\n", m.getMissingClasses()));
        sb.append(String.format("- **Hàm / Phương thức (Methods/Functions) còn thiếu:** %d\n\n", m.getMissingMethodsAndFunctions()));

        sb.append("| Loại thực thể (Entity Type) | Số lượng thiếu | Trạng thái ghi chú |\n");
        sb.append("| :--- | :--- | :--- |\n");
        for (Map.Entry<String, Long> entry : m.getMissingByType().entrySet()) {
            sb.append(String.format("| `%s` | %d | Cần bổ sung tài liệu mô tả |\n", entry.getKey(), entry.getValue()));
        }
        sb.append("\n");

        // 4. Phân loại cảnh báo sai lệch (Drift Alerts)
        sb.append("## 4. Phân Loại Chi Tiết Cảnh Báo Sai Lệch (Drift Alerts)\n\n");
        sb.append(String.format("Tổng số cảnh báo đang mở (OPEN): **%d**\n\n", r.getTotalOpenDriftAlerts()));
        sb.append("| Mức độ nghiêm trọng (Severity) | Số lượng cảnh báo | Mức độ rủi ro |\n");
        sb.append("| :--- | :--- | :--- |\n");
        Map<String, Long> a = r.getOpenAlertsBySeverity();
        sb.append(String.format("| 🔴 **CRITICAL** | **%d** | Cực kỳ nghiêm trọng - Chặn hợp nhất Pull Request |\n", a.getOrDefault("CRITICAL", 0L)));
        sb.append(String.format("| 🟠 **HIGH** | **%d** | Cao - Cần xem xét cập nhật tài liệu sớm |\n", a.getOrDefault("HIGH", 0L)));
        sb.append(String.format("| 🟡 **MEDIUM** | **%d** | Trung bình - Thay đổi nhỏ logic/signature |\n", a.getOrDefault("MEDIUM", 0L)));
        sb.append(String.format("| 🟢 **LOW** | **%d** | Thấp - Thay đổi định dạng/chú thích |\n\n", a.getOrDefault("LOW", 0L)));

        // 5. Chi tiết theo từng kho lưu trữ
        if (r.getRepositoryDetails() != null && !r.getRepositoryDetails().isEmpty()) {
            sb.append("## 5. Thống Kê Theo Từng Kho Lưu Trữ (Repositories)\n\n");
            sb.append("| ID | Tên kho lưu trữ | Tỷ lệ bao phủ | Tổng thực thể | Đã có tài liệu | Cảnh báo mở |\n");
            sb.append("| :--- | :--- | :--- | :--- | :--- | :--- |\n");
            for (RepoCoverageDto repo : r.getRepositoryDetails()) {
                sb.append(String.format("| %d | `%s` | **%.2f%%** | %d | %d | %d |\n",
                        repo.getRepoId(), repo.getRepoName(), repo.getCoveragePercent(),
                        repo.getTotalEntities(), repo.getDocumentedEntities(), repo.getOpenDriftCount()));
            }
            sb.append("\n");
        }

        sb.append("---\n");
        sb.append("*Báo cáo được sinh tự động bởi LivingDocs Health Monitor Engine.*\n");

        return sb.toString();
    }
}
