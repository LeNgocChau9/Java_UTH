package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class UserRepositoryAdapter implements UserRepositoryPort {

    private final SpringDataUserRepository springDataUserRepository;

    @Override
    public Optional<User> findByEmail(String email) {
        return springDataUserRepository.findByEmail(email).map(this::toDomain);
    }

    @Override
    public Optional<User> findById(Long userId) {
        return springDataUserRepository.findById(userId).map(this::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return springDataUserRepository.existsByEmail(email);
    }

    @Override
    public User save(User user) {
        UserEntity entity = toEntity(user);
        UserEntity savedEntity = springDataUserRepository.save(entity);
        return toDomain(savedEntity);
    }

    private User toDomain(UserEntity entity) {
        return User.builder()
                .userId(entity.getUserId())
                .email(entity.getEmail())
                .passwordHash(entity.getPasswordHash())
                .fullName(entity.getFullName())
                .avatarUrl(entity.getAvatarUrl())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private UserEntity toEntity(User user) {
        return UserEntity.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .passwordHash(user.getPasswordHash())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus() != null ? user.getStatus() : "ACTIVE")
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
