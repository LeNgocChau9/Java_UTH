package com.example.livingdocs_backend.application.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminApproveUserRequest {
    @JsonAlias("workspaceId")
    private Long enterpriseId;
    private String role;
}
