package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CiToken {
    private Long tokenId;
    private String tokenName;
    private String tokenHash;
    private String tokenPrefix;
    private Long createdByUserId;
    private Long repositoryId;
    private String description;
    private boolean isRevoked;
    private Instant expiresAt;
    private Instant lastUsedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
