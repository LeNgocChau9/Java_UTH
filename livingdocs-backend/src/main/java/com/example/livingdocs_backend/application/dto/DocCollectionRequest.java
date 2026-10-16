package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocCollectionRequest {

    @NotBlank(message = "Tên bộ sưu tập không được để trống")
    @Schema(description = "Tên bộ sưu tập", example = "Tài liệu Kiến trúc & Hướng dẫn Kỹ thuật")
    private String name;

    @Schema(description = "Mô tả bộ sưu tập", example = "Tập hợp các tài liệu kiến trúc, API Reference và hướng dẫn.")
    private String description;
}
