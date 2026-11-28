package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private Long userId;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String status;
    private Set<String> roles;
    private Long enterpriseId;
    private String enterpriseName;
    private Long workspaceId;
    private String githubUsername;
    private Instant createdAt;
    private UserNotificationPreferencesDto notificationPreferences;
}
