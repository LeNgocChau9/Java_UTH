package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.AuthResponse;
import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.dto.RegisterRequest;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;

public interface AuthServicePort {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    UserProfileResponse getCurrentUserProfile(String email);
}
