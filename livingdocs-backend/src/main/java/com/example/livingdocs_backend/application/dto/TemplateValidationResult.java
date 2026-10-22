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
public class TemplateValidationResult {

    private Long templateId;

    private boolean valid;

    private boolean warning;

    private List<String> missingHeadings;

    private List<String> warnings;

    public static TemplateValidationResult passed(Long templateId) {
        return TemplateValidationResult.builder()
                .templateId(templateId)
                .valid(true)
                .warning(false)
                .missingHeadings(List.of())
                .warnings(List.of())
                .build();
    }
}
