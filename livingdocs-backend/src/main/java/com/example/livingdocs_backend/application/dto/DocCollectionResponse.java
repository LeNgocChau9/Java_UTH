package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocCollectionResponse {

    @Schema(description = "ID bộ sưu tập", example = "1")
    private Long id;

    @Schema(description = "Tên bộ sưu tập", example = "Tài liệu Kiến trúc & Hướng dẫn Kỹ thuật")
    private String name;

    @Schema(description = "Mô tả bộ sưu tập", example = "Tập hợp các tài liệu kiến trúc, API Reference và hướng dẫn.")
    private String description;

    @Schema(description = "Số lượng tài liệu trong bộ sưu tập", example = "3")
    private Long documentCount;

    @Schema(description = "Thời điểm tạo")
    private Instant createdAt;

    @Schema(description = "Thời điểm cập nhật")
    private Instant updatedAt;
}
