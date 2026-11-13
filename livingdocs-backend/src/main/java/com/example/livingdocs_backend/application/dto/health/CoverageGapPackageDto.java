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
@Schema(description = "Nhóm các thực thể thiếu tài liệu theo Gói mã nguồn (Package)")
public class CoverageGapPackageDto {

    @Schema(description = "Tên gói mã nguồn / thư mục", example = "com.example.service")
    private String packageName;

    @Schema(description = "Tổng số thực thể thiếu tài liệu trong gói", example = "5")
    private int totalMissing;

    @Builder.Default
    @Schema(description = "Danh sách các lớp có khoảng trống tài liệu")
    private List<CoverageGapClassDto> classes = new ArrayList<>();

    @Builder.Default
    @Schema(description = "Toàn bộ danh sách thực thể thiếu trong gói")
    private List<CoverageGapItemDto> items = new ArrayList<>();
}
