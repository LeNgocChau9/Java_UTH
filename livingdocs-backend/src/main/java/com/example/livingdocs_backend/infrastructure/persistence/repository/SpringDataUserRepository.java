package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataUserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<UserEntity> findByGithubUserId(Long githubUserId);
    Optional<UserEntity> findByGithubUsernameIgnoreCase(String githubUsername);
    List<UserEntity> findByWorkspaceId(Long workspaceId);
    long countByWorkspaceId(Long workspaceId);

    @Query(value = """
        SELECT r.role_name
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        WHERE u.user_id = :userId
        UNION
        SELECT r.role_name
        FROM workspace_members wm
        JOIN roles r ON r.role_id = wm.role_id
        WHERE wm.user_id = :userId
          AND NOT EXISTS (
              SELECT 1 FROM users u2 WHERE u2.user_id = :userId AND u2.role_id IS NOT NULL
          )
    """, nativeQuery = true)
    List<String> findRoleNamesByUserId(@Param("userId") Long userId);

    @Modifying
    @Query(value = """
        INSERT INTO workspace_members (workspace_id, user_id, role_id)
        VALUES (:workspaceId, :userId, :roleId)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
    """, nativeQuery = true)
    void assignWorkspaceRole(@Param("workspaceId") Long workspaceId,
                             @Param("userId") Long userId,
                             @Param("roleId") Long roleId);

    @Query(value = "SELECT role_id FROM roles WHERE role_name = :roleName", nativeQuery = true)
    Optional<Long> findRoleIdByName(@Param("roleName") String roleName);

    @Modifying
    @Query(value = """
        INSERT INTO workspace_members (workspace_id, user_id, role_id)
        VALUES (:workspaceId, :userId, :roleId)
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id
    """, nativeQuery = true)
    void upsertWorkspaceMemberRole(@Param("workspaceId") Long workspaceId,
                                   @Param("userId") Long userId,
                                   @Param("roleId") Long roleId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM workspace_members WHERE user_id = :userId", nativeQuery = true)
    void deleteWorkspaceMembersByUserId(@Param("userId") Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM workspace_members WHERE workspace_id = :workspaceId", nativeQuery = true)
    void deleteWorkspaceMembersByWorkspaceId(@Param("workspaceId") Long workspaceId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE users SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE user_id = :userId
    """, nativeQuery = true)
    void updateUserStatus(@Param("userId") Long userId,
                          @Param("status") String status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE users SET role_id = :roleId, updated_at = CURRENT_TIMESTAMP WHERE user_id = :userId
    """, nativeQuery = true)
    void updateUserRoleId(@Param("userId") Long userId,
                          @Param("roleId") Long roleId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE users SET workspace_id = :workspaceId, updated_at = CURRENT_TIMESTAMP WHERE user_id = :userId
    """, nativeQuery = true)
    void updateUserWorkspaceId(@Param("userId") Long userId,
                               @Param("workspaceId") Long workspaceId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE users SET workspace_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE workspace_id = :workspaceId
    """, nativeQuery = true)
    void clearWorkspaceForUsers(@Param("workspaceId") Long workspaceId);
}
