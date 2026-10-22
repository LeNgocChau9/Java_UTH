package com.example.livingdocs_backend.application.dto;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentTemplateVersion;
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
public class TemplateVersionResponse {

    @Schema(example = "1")
    private Long versionId;

    @Schema(example = "1")
    private Long templateId;

    @Schema(example = "2")
    private Integer versionNum;

    private String structureJson;

    @Schema(example = "{\"required\":[\"overview\"]}")
    private String rulesJson;

    @Schema(example = "1")
    private Long createdBy;

    private Instant createdAt;

    public static TemplateVersionResponse from(DocumentTemplateVersion version) {
        return TemplateVersionResponse.builder()
                .versionId(version.getVersionId())
                .templateId(version.getTemplateId())
                .versionNum(version.getVersionNum())
                .structureJson(version.getStructureJson())
                .rulesJson(version.getRulesJson())
                .createdBy(version.getCreatedBy())
                .createdAt(version.getCreatedAt())
                .build();
    }
}
