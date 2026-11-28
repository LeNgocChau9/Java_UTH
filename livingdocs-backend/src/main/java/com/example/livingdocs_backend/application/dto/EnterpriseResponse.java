package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnterpriseResponse {
    private Long enterpriseId;
    private String name;
    private String slug;
    private Long userCount;
    private Long repositoryCount;
    private Instant createdAt;
    private Instant updatedAt;
}
