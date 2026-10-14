package com.example.livingdocs_backend.application.dto;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
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
public class DocTemplateResponse {

    @Schema(example = "1")
    private Long id;

    @Schema(example = "API Reference")
    private String name;

    @Schema(example = "API_REFERENCE")
    private String type;

    @Schema(example = "{\"sections\":[{\"key\":\"overview\",\"title\":\"Tổng quan\"}]}")
    private String structureJson;

    @Schema(example = "true")
    private Boolean isDefault;

    private Instant createdAt;

    public static DocTemplateResponse from(DocTemplate template) {
        return DocTemplateResponse.builder()
                .id(template.getId())
                .name(template.getName())
                .type(template.getType())
                .structureJson(template.getStructureJson())
                .isDefault(template.getIsDefault())
                .createdAt(template.getCreatedAt())
                .build();
    }
}
