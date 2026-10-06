package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.User;

import java.util.Optional;

public interface UserRepositoryPort {
    Optional<User> findByEmail(String email);
    Optional<User> findById(Long userId);
    boolean existsByEmail(String email);
    User save(User user);
}
