package com.example.livingdocs_backend.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCiTokenRequest {

    @NotBlank(message = "Token name is required")
    @Size(max = 100, message = "Token name cannot exceed 100 characters")
    private String tokenName;

    private Long repositoryId;

    private String description;

    // Optional expiration in days (e.g. 30, 90, 365, null means no expiration)
    private Integer expiresInDays;
}
