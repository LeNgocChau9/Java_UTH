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
public class TemplateVersionRequest {

    @NotBlank(message = "Cấu trúc JSON không được để trống")
    @Schema(description = "JSON cấu trúc của phiên bản này",
            example = "{\"sections\":[{\"key\":\"overview\",\"title\":\"Tổng quan\"}]}")
    private String structureJson;

    @Schema(description = "Luật kiểm tra của phiên bản. Bỏ trống thì lưu {}",
            example = "{\"required\":[\"overview\"]}")
    private String rulesJson;

    @Schema(description = "user_id của người tạo phiên bản", example = "1")
    private Long createdBy;
}
