package com.example.livingdocs_backend.application.dto.health;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Phản hồi danh sách khoảng trống tài liệu (Coverage Gaps)")
public class CoverageGapsResponse {

    @Schema(description = "ID kho lưu trữ", example = "1")
    private Long repositoryId;

    @Schema(description = "Tên kho lưu trữ", example = "livingdocs-backend")
    private String repositoryName;

    @Schema(description = "Tổng số thực thể còn thiếu tài liệu", example = "15")
    private long totalMissing;

    @Schema(description = "Số lớp còn thiếu tài liệu", example = "3")
    private long missingClasses;

    @Schema(description = "Số phương thức / hàm còn thiếu tài liệu", example = "12")
    private long missingMethods;

    @Builder.Default
    @Schema(description = "Danh sách phân nhóm theo Gói mã nguồn (Package)", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<CoverageGapPackageDto> packages = new ArrayList<>();

    @Builder.Default
    @Schema(description = "Danh sách phẳng toàn bộ thực thể thiếu tài liệu để hiển thị bảng", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<CoverageGapItemDto> items = new ArrayList<>();
}
