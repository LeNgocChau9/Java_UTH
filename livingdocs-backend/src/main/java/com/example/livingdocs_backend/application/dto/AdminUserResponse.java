package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Set;

/** Thông tin 1 người dùng cho màn hình Quản trị người dùng (Admin). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {
    private Long userId;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String status;
    private Set<String> roles;
    private Instant createdAt;
}
