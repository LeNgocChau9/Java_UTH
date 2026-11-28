package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.WorkspaceEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataWorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class UserRepositoryAdapter implements UserRepositoryPort {

    private static final long DEFAULT_WORKSPACE_ID = 1L;
    private static final long DEFAULT_ROLE_ID = 5L;

    private final SpringDataUserRepository springDataUserRepository;

    @Autowired(required = false)
    private SpringDataWorkspaceRepository workspaceRepository;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @Override
    public Optional<User> findByEmail(String email) {
        return springDataUserRepository.findByEmail(email).map(this::toDomain);
    }

    @Override
    public Optional<User> findById(Long userId) {
        return springDataUserRepository.findById(userId).map(this::toDomain);
    }

    @Override
    public Optional<User> findByGithubUserId(Long githubUserId) {
        if (githubUserId == null) {
            return Optional.empty();
        }
        return springDataUserRepository.findByGithubUserId(githubUserId).map(this::toDomain);
    }

    @Override
    public Optional<User> findByGithubUsername(String githubUsername) {
        if (githubUsername == null || githubUsername.isBlank()) {
            return Optional.empty();
        }
        return springDataUserRepository.findByGithubUsernameIgnoreCase(githubUsername.trim()).map(this::toDomain);
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
        ensureRoleAndDefaultWorkspace("DEVELOPER", userId);
        Long roleId = springDataUserRepository.findRoleIdByName("DEVELOPER").orElse(DEFAULT_ROLE_ID);
        springDataUserRepository.updateUserRoleId(userId, roleId);
        springDataUserRepository.updateUserWorkspaceId(userId, DEFAULT_WORKSPACE_ID);
        springDataUserRepository.deleteWorkspaceMembersByUserId(userId);
        springDataUserRepository.upsertWorkspaceMemberRole(DEFAULT_WORKSPACE_ID, userId, roleId);
    }

    @Override
    public List<User> findAll() {
        Map<Long, String> workspaceNames = loadWorkspaceNameMap();
        return springDataUserRepository.findAll().stream()
                .map(e -> toDomain(e, workspaceNames))
                .toList();
    }

    @Override
    public List<User> findByWorkspaceId(Long workspaceId) {
        if (workspaceId == null) {
            return Collections.emptyList();
        }
        Map<Long, String> workspaceNames = loadWorkspaceNameMap();
        return springDataUserRepository.findByWorkspaceId(workspaceId).stream()
                .map(e -> toDomain(e, workspaceNames))
                .toList();
    }

    @Override
    @Transactional
    public User updateStatus(Long userId, String status) {
        springDataUserRepository.updateUserStatus(userId, status);
        return springDataUserRepository.findById(userId)
                .map(this::toDomain)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng"));
    }

    @Override
    @Transactional
    public void changeRole(Long userId, String roleName) {
        String normalizedRole = RoleType.fromString(roleName).getRawName();
        ensureRoleExists(normalizedRole);
        Long roleId = springDataUserRepository.findRoleIdByName(normalizedRole)
                .orElseThrow(() -> new AuthenticationException("Vai trò không hợp lệ: " + roleName));
        springDataUserRepository.updateUserRoleId(userId, roleId);

        // Keep workspace_members synced ONLY if the user is currently assigned to an Enterprise.
        Long currentWorkspaceId = springDataUserRepository.findById(userId)
                .map(UserEntity::getWorkspaceId)
                .orElse(null);
        if (currentWorkspaceId != null) {
            springDataUserRepository.deleteWorkspaceMembersByUserId(userId);
            springDataUserRepository.upsertWorkspaceMemberRole(currentWorkspaceId, userId, roleId);
        }
    }

    @Override
    @Transactional
    public void assignEnterprise(Long userId, Long workspaceId) {
        UserEntity entity = springDataUserRepository.findById(userId)
                .orElseThrow(() -> new AuthenticationException("Không tìm thấy người dùng"));
        springDataUserRepository.updateUserWorkspaceId(userId, workspaceId);
        springDataUserRepository.deleteWorkspaceMembersByUserId(userId);

        if (workspaceId != null) {
            Long roleId = entity.getRoleId();
            if (roleId == null) {
                ensureRoleExists("DEVELOPER");
                roleId = springDataUserRepository.findRoleIdByName("DEVELOPER").orElse(DEFAULT_ROLE_ID);
                springDataUserRepository.updateUserRoleId(userId, roleId);
            }
            springDataUserRepository.upsertWorkspaceMemberRole(workspaceId, userId, roleId);
        }
    }

    private void ensureRoleExists(String roleName) {
        if (jdbcTemplate == null) {
            return;
        }
        try {
            jdbcTemplate.update("""
                INSERT INTO roles (role_name, description)
                VALUES (?, ?)
                ON CONFLICT (role_name) DO NOTHING
            """, roleName, "Vai trò hệ thống " + roleName);
        } catch (Exception ignored) {
        }
    }

    private void ensureRoleAndDefaultWorkspace(String roleName, Long fallbackOwnerId) {
        ensureRoleExists(roleName);
        if (jdbcTemplate == null) {
            return;
        }
        try {
            Long ownerId = fallbackOwnerId != null ? fallbackOwnerId : 1L;
            jdbcTemplate.update("""
                INSERT INTO workspaces (workspace_id, name, slug, owner_id)
                SELECT 1, 'LivingDocs Core Workspace', 'livingdocs-core',
                       COALESCE((SELECT MIN(user_id) FROM users), ?)
                WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE workspace_id = 1)
                ON CONFLICT (workspace_id) DO NOTHING
            """, ownerId);
        } catch (Exception ignored) {
        }
    }

    private Map<Long, String> loadWorkspaceNameMap() {
        if (workspaceRepository == null) {
            return Collections.emptyMap();
        }
        try {
            Map<Long, String> map = new HashMap<>();
            for (WorkspaceEntity ws : workspaceRepository.findAll()) {
                if (ws.getWorkspaceId() != null) {
                    map.put(ws.getWorkspaceId(), ws.getName());
                }
            }
            return map;
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
    }

    private String resolveWorkspaceName(Long workspaceId, Map<Long, String> cache) {
        if (workspaceId == null) {
            return null;
        }
        if (cache != null) {
            return cache.get(workspaceId);
        }
        if (workspaceRepository == null) {
            return null;
        }
        try {
            return workspaceRepository.findById(workspaceId).map(WorkspaceEntity::getName).orElse(null);
        } catch (Exception ignored) {
            return null;
        }
    }

    private User toDomain(UserEntity entity) {
        return toDomain(entity, null);
    }

    private User toDomain(UserEntity entity, Map<Long, String> workspaceNames) {
        List<String> roleNames = springDataUserRepository.findRoleNamesByUserId(entity.getUserId());
        Set<RoleType> roles = new HashSet<>();
        if (roleNames != null && !roleNames.isEmpty()) {
            for (String r : roleNames) {
                roles.add(RoleType.fromString(r));
            }
        } else {
            roles.add(RoleType.ROLE_DEVELOPER);
        }

        return User.builder()
                .userId(entity.getUserId())
                .email(entity.getEmail())
                .passwordHash(entity.getPasswordHash())
                .fullName(entity.getFullName())
                .avatarUrl(entity.getAvatarUrl())
                .status(entity.getStatus())
                .workspaceId(entity.getWorkspaceId())
                .workspaceName(resolveWorkspaceName(entity.getWorkspaceId(), workspaceNames))
                .roleId(entity.getRoleId())
                .githubUserId(entity.getGithubUserId())
                .githubUsername(entity.getGithubUsername())
                .rejectionReason(entity.getRejectionReason())
                .approvedBy(entity.getApprovedBy())
                .approvedAt(entity.getApprovedAt())
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
                .workspaceId(user.getWorkspaceId())
                .roleId(user.getRoleId())
                .githubUserId(user.getGithubUserId())
                .githubUsername(user.getGithubUsername())
                .rejectionReason(user.getRejectionReason())
                .approvedBy(user.getApprovedBy())
                .approvedAt(user.getApprovedAt())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
