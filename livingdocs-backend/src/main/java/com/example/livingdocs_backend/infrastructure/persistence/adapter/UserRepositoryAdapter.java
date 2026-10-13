package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class UserRepositoryAdapter implements UserRepositoryPort {

    /** Workspace mặc định 'LivingDocs Core Workspace' (seed trong docker/postgres/init/00_init.sql). */
    private static final long DEFAULT_WORKSPACE_ID = 1L;
    /** Vai trò mặc định DEVELOPER cho người dùng tự đăng ký / đăng nhập qua GitHub (seed roles). */
    private static final long DEFAULT_ROLE_ID = 5L;

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

    @Override
    @Transactional
    public void assignDefaultWorkspaceRole(Long userId) {
        springDataUserRepository.assignWorkspaceRole(DEFAULT_WORKSPACE_ID, userId, DEFAULT_ROLE_ID);
    }

    @Override
    public java.util.List<User> findAll() {
        return springDataUserRepository.findAll().stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public User updateStatus(Long userId, String status) {
        springDataUserRepository.updateUserStatus(userId, status);
        return springDataUserRepository.findById(userId)
                .map(this::toDomain)
                .orElseThrow(() -> new com.example.livingdocs_backend.domain.exception.AuthenticationException("Không tìm thấy người dùng"));
    }

    @Override
    @Transactional
    public void changeRole(Long userId, String roleName) {
        Long roleId = springDataUserRepository.findRoleIdByName(roleName)
                .orElseThrow(() -> new com.example.livingdocs_backend.domain.exception.AuthenticationException("Vai trò không hợp lệ: " + roleName));
        springDataUserRepository.upsertWorkspaceMemberRole(DEFAULT_WORKSPACE_ID, userId, roleId);
    }

    private User toDomain(UserEntity entity) {
        java.util.List<String> roleNames = springDataUserRepository.findRoleNamesByUserId(entity.getUserId());
        java.util.Set<com.example.livingdocs_backend.domain.model.RoleType> roles = new java.util.HashSet<>();
        if (roleNames != null && !roleNames.isEmpty()) {
            for (String r : roleNames) {
                roles.add(com.example.livingdocs_backend.domain.model.RoleType.fromString(r));
            }
        } else {
            roles.add(com.example.livingdocs_backend.domain.model.RoleType.ROLE_DEVELOPER);
        }

        return User.builder()
                .userId(entity.getUserId())
                .email(entity.getEmail())
                .passwordHash(entity.getPasswordHash())
                .fullName(entity.getFullName())
                .avatarUrl(entity.getAvatarUrl())
                .status(entity.getStatus())
                .roles(roles)
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
