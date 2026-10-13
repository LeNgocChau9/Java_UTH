package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.User;

import java.util.Optional;

public interface UserRepositoryPort {
    Optional<User> findByEmail(String email);
    Optional<User> findById(Long userId);
    boolean existsByEmail(String email);
    User save(User user);
    void assignDefaultWorkspaceRole(Long userId);
    java.util.List<User> findAll();
    User updateStatus(Long userId, String status);
    void changeRole(Long userId, String roleName);
}
