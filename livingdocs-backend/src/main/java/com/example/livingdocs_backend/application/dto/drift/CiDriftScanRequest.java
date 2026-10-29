package com.example.livingdocs_backend.application.dto.drift;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request payload gửi từ GitHub Action lên endpoint POST /api/ci/drift-scan.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CiDriftScanRequest {

    @NotNull(message = "repo_id không được để trống")
    @Schema(description = "ID của repository trong LivingDocs", example = "1")
    private Long repoId;

    @Schema(description = "Số Pull Request trên GitHub (nếu chạy trong luồng PR)", example = "42")
    private Integer prNumber;

    @Schema(description = "Commit hash đang được quét", example = "a1b2c3d4e5f6")
    private String commitHash;

    @Schema(description = "Tên nhánh git", example = "feature/payment-v2")
    private String branch;

    @Valid
    @Schema(description = "Danh sách các cảnh báo trôi dạt phát hiện được từ CI quét")
    private List<DriftScanItemDto> alerts;
}

