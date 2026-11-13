package com.example.livingdocs_backend.application.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO cấu hình chính sách phê duyệt (1 cấp vs 2 cấp) theo loại tài liệu (doc_type).
 * - 1 cấp: Staff duyệt -> chuyển thẳng sang PUBLISHED.
 * - 2 cấp: Staff duyệt -> chuyển sang UNDER_REVIEW_MANAGER -> Manager duyệt mới sang PUBLISHED.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalPolicyDto {

    @Schema(description = "Loại tài liệu (doc_type), ví dụ: API, ARCHITECTURE, USER_GUIDE, RELEASE_NOTE, DEFAULT", example = "API")
    private String docType;

    @JsonProperty("tiers")
    @JsonAlias({"approvalTiers", "requiredTiers"})
    @Schema(description = "Số cấp phê duyệt: 1 (1 cấp) hoặc 2 (2 cấp)", example = "1")
    @Builder.Default
    private Integer tiers = 2;

    @Schema(description = "Mô tả mục đích hoặc quy định của chính sách", example = "Tài liệu kỹ thuật API chỉ cần Staff kiểm duyệt 1 cấp và xuất bản trực tiếp")
    private String description;

    @Schema(description = "Thời gian cập nhật gần nhất (ISO-8601)", example = "2026-11-13T10:30:00Z")
    private String updatedAt;

    @Schema(description = "Tên hoặc ID người cập nhật gần nhất", example = "admin@livingdocs.internal")
    private String updatedBy;
}
