package com.example.livingdocs_backend.application.dto.job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RepoScanJobPayload {
    private Long repositoryId;
    private String branch;
    private Long actorId;
}
