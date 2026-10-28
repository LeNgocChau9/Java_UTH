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
public class CiTokenResponse {
    private Long tokenId;
    private String tokenName;
    private String tokenPrefix;
    private Long createdByUserId;
    private String createdByUserName;
    private Long repositoryId;
    private String repositoryName;
    private String description;
    private boolean isRevoked;
    private Instant expiresAt;
    private Instant lastUsedAt;
    private Instant createdAt;
}
