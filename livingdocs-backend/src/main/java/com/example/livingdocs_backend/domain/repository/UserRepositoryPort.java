package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.User;

import java.util.List;
import java.util.Optional;

public interface UserRepositoryPort {
    Optional<User> findByEmail(String email);
    Optional<User> findById(Long userId);
    Optional<User> findByGithubUserId(Long githubUserId);
    Optional<User> findByGithubUsername(String githubUsername);
    boolean existsByEmail(String email);
    User save(User user);
    void assignDefaultWorkspaceRole(Long userId);
    List<User> findAll();
    List<User> findByWorkspaceId(Long workspaceId);
    User updateStatus(Long userId, String status);
    void changeRole(Long userId, String roleName);
    void assignEnterprise(Long userId, Long workspaceId);
}
