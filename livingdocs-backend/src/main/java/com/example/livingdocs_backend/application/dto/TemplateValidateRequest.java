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
public class TemplateValidateRequest {

    @NotBlank(message = "Nội dung Markdown không được để trống")
    @Schema(description = "Markdown do AI sinh ra", example = "# Overview\n\n## Endpoints\n")
    private String markdown;
}
