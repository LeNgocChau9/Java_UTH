package com.example.livingdocs_backend.application.dto.job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiDocGenJobPayload {
    private Long repositoryId;
    private Long documentId;
    private String title;
    private String docType;
    private Long actorId;
    private String actorRole;
    private List<Long> entityIds;
    private String prompt;
}
