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
public class DocTemplateRequest {

    @NotBlank(message = "Tên mẫu không được để trống")
    @Schema(description = "Tên hiển thị của mẫu tài liệu", example = "API Reference")
    private String name;

    @NotBlank(message = "Loại mẫu không được để trống")
    @Schema(description = "Mã loại, viết hoa và không trùng", example = "API_REFERENCE")
    private String type;

    @NotBlank(message = "Cấu trúc JSON không được để trống")
    @Schema(description = "JSON định nghĩa các section", example = "{\"sections\":[{\"key\":\"overview\",\"title\":\"Tổng quan\",\"required\":true}]}")
    private String structureJson;

    @Schema(description = "Mẫu mặc định của loại này", example = "true")
    private Boolean isDefault;
}
