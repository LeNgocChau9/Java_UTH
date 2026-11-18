package com.example.livingdocs_backend.application.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Kết quả thẩm định chất lượng tài liệu và phát hiện ảo giác AI.
 * (Anti-Hallucination Gate & Quality Gate Response)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả thẩm định chất lượng và báo cáo ảo giác AI")
public class DocumentQualityEvaluationResponse {

    @Schema(description = "ID repository", example = "1")
    private Long repositoryId;

    @Schema(description = "Tên repository", example = "LeNgocChau9/Java_UTH")
    private String repositoryName;

    @Schema(description = "ID tài liệu (nếu có)", example = "42")
    private Long documentId;

    @Schema(description = "Tiêu đề tài liệu", example = "Tài liệu API User Service")
    private String documentTitle;

    @Schema(description = "Đường dẫn file mã nguồn đối chiếu", example = "src/main/java/com/example/service/UserService.java")
    private String filePath;

    @Schema(description = "Thời điểm thẩm định")
    @Builder.Default
    private Instant evaluatedAt = Instant.now();

    // ── 3 CHỈ SỐ THẬT (REAL METRICS) ──

    @Schema(description = "(1) Độ phủ thực thể code (0.0 - 100.0%)", example = "87.5")
    private Double entityCoveragePercent;

    @Schema(description = "(1) Độ phủ tham số kỹ thuật (0.0 - 100.0%)", example = "92.0")
    private Double paramCoveragePercent;

    @Schema(description = "(1) Chỉ số tổng hợp Độ phủ Entity & Param (0.0 - 100.0%)", example = "88.85")
    private Double overallCoveragePercent;

    @Schema(description = "(2) Điểm Chống Ảo Giác AI (Anti-Hallucination Score 0.0 - 100.0%)", example = "100.0")
    private Double antiHallucinationPercent;

    @Schema(description = "(3) Mức độ tuân thủ cấu trúc Template (0.0 - 100.0%)", example = "95.0")
    private Double templateCompliancePercent;

    // ── TỔNG ĐIỂM VÀ ĐIỀU KIỆN CHẶN PR GATE ──

    @Schema(description = "Điểm chất lượng tổng hợp (0.0 - 100.0)", example = "94.2")
    private Double overallQualityScore;

    @Schema(description = "Xếp hạng chất lượng: EXCELLENT, GOOD, WARN, BLOCKED", example = "EXCELLENT")
    private String qualityRating;

    @Schema(description = "Tài liệu có vượt qua cổng kiểm soát chất lượng hay không", example = "true")
    private Boolean passed;

    @Schema(description = "Trạng thái PR Gate: PASSED (Cho phép gộp) hoặc BLOCKED (Chặn gộp PR)", example = "PASSED")
    private String prGateStatus;

    @Schema(description = "Ngưỡng điểm chất lượng áp dụng", example = "75.0")
    private Double appliedQualityThreshold;

    @Schema(description = "Ngưỡng điểm chống ảo giác áp dụng", example = "80.0")
    private Double appliedAntiHallucinationThreshold;

    @Schema(description = "Khuyến nghị hành động và nhận xét tổng quan", example = "Tài liệu đạt chuẩn chất lượng cao, không phát hiện ký hiệu ảo giác.")
    private String recommendation;

    // ── THỐNG KÊ CHI TIẾT ──

    @Schema(description = "Tổng số thực thể code quét được từ AST", example = "16")
    private Integer totalCodeEntitiesScanned;

    @Schema(description = "Số thực thể code đã được tài liệu hóa trong Markdown", example = "14")
    private Integer documentedCodeEntitiesCount;

    @Schema(description = "Số thực thể code còn thiếu", example = "2")
    private Integer missingCodeEntitiesCount;

    @Schema(description = "Tổng số tham số kỹ thuật quét được", example = "25")
    private Integer totalParamsScanned;

    @Schema(description = "Số tham số kỹ thuật đã được mô tả", example = "23")
    private Integer documentedParamsCount;

    @Schema(description = "Số tham số kỹ thuật còn thiếu", example = "2")
    private Integer missingParamsCount;

    @Schema(description = "Tổng số ký hiệu code quét trong văn bản Markdown", example = "48")
    private Integer totalSymbolsChecked;

    @Schema(description = "Số lượng ký hiệu ma / ảo giác AI (Phantom Symbols) phát hiện", example = "0")
    private Integer phantomSymbolsCount;

    @Schema(description = "Tổng số đề mục bắt buộc theo Template", example = "5")
    private Integer requiredHeadingsCount;

    @Schema(description = "Số đề mục bắt buộc đã có trong tài liệu", example = "5")
    private Integer matchedHeadingsCount;

    // ── DANH SÁCH CẢNH BÁO CHI TIẾT ──

    @Schema(description = "Danh sách các ký hiệu ảo giác (Phantom Symbols) phát hiện")
    @Builder.Default
    private List<PhantomSymbolDto> phantomSymbols = new ArrayList<>();

    @Schema(description = "Danh sách các thực thể code thật bị thiếu trong tài liệu")
    @Builder.Default
    private List<MissingEntityDto> missingEntities = new ArrayList<>();

    @Schema(description = "Danh sách các tham số bị thiếu trong tài liệu")
    @Builder.Default
    private List<MissingParamDto> missingParams = new ArrayList<>();

    @Schema(description = "Danh sách các đề mục Template bắt buộc bị thiếu")
    @Builder.Default
    private List<String> missingTemplateHeadings = new ArrayList<>();

    @Schema(description = "Danh sách cảnh báo chất lượng tổng hợp phân loại theo severity")
    @Builder.Default
    private List<QualityWarningDto> qualityWarnings = new ArrayList<>();
}
