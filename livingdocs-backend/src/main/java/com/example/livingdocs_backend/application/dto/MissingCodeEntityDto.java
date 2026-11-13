package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MissingCodeEntityDto {
    private Long entityId;
    private String entityType; // CONTROLLER, SERVICE, ENTITY, REPOSITORY, CLASS, METHOD
    private String className;
    private String methodName;
    private String filePath;
    private String signature;
    private String suggestion;
    private String suggestedMarkdown;
}
