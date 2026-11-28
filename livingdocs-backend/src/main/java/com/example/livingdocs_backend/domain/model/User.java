package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Long userId;
    private String email;
    private String passwordHash;
    private String fullName;
    private String avatarUrl;
    private String status;
    private Long workspaceId;
    private String workspaceName;
    private Long roleId;
    private Long githubUserId;
    private String githubUsername;
    private String rejectionReason;
    private Long approvedBy;
    private Instant approvedAt;
    @Builder.Default
    private Set<RoleType> roles = new HashSet<>();
    private Instant createdAt;
    private Instant updatedAt;
}
