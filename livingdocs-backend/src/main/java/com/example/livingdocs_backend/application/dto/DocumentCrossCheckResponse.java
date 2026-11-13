package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentCrossCheckResponse {
    private Long templateId;
    private String templateName;
    private boolean templateValid;
    private List<String> missingTemplateHeadings;
    private List<String> templateWarnings;

    private Long repositoryId;
    private int totalCodeEntities;
    private int documentedCodeEntities;
    private int missingCodeEntitiesCount;
    private double coveragePercentage;
    private List<MissingCodeEntityDto> missingCodeEntities;

    private List<CrossCheckSuggestionDto> suggestions;
}
