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
public class CreatedCiTokenResponse {
    private Long tokenId;
    private String tokenName;
    private String token; // The raw secret string shown only once
    private String tokenPrefix;
    private Long repositoryId;
    private Instant expiresAt;
    private Instant createdAt;
    private String message;
}
