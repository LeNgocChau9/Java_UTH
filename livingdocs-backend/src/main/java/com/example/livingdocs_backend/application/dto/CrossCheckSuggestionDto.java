package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrossCheckSuggestionDto {
    private String type; // TEMPLATE_HEADING, CODE_ENTITY, GENERAL
    private String title;
    private String description;
    private String suggestedMarkdown;
}
