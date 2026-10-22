package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.GitHubProfileRequest;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;

public interface AuthServicePort {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    AuthResponse loginWithGithub(GitHubProfileRequest request);
    AuthResponse refreshToken(String token);
    UserProfileResponse getCurrentUserProfile(String email);
    UserProfileResponse updateProfile(String email, com.example.livingdocs_backend.application.dto.UpdateProfileRequest request);
}
