package com.example.livingdocs_backend.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Thông tin danh tính người dùng lấy từ GitHub, dùng làm input cho
 * use-case đăng nhập/đăng ký qua GitHub OAuth (tầng application).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubProfileRequest {
    private Long githubId;
    private String login;
    private String name;
    private String email;
    private String avatarUrl;
}
