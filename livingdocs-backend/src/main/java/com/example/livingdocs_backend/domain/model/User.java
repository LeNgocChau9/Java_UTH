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
public class User {
    private Long userId;
    private String email;
    private String passwordHash;
    private String fullName;
    private String avatarUrl;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
