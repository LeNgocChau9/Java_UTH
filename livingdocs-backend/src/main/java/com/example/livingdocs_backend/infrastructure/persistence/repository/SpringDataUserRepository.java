package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataUserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmail(String email);

    @org.springframework.data.jpa.repository.Query(value = """
        SELECT DISTINCT r.role_name
        FROM roles r
        JOIN workspace_members wm ON r.role_id = wm.role_id
        WHERE wm.user_id = :userId
    """, nativeQuery = true)
    java.util.List<String> findRoleNamesByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);

    @Modifying
    @org.springframework.data.jpa.repository.Query(value = """
        INSERT INTO workspace_members (workspace_id, user_id, role_id)
        VALUES (:workspaceId, :userId, :roleId)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
    """, nativeQuery = true)
    void assignWorkspaceRole(@org.springframework.data.repository.query.Param("workspaceId") Long workspaceId,
                             @org.springframework.data.repository.query.Param("userId") Long userId,
                             @org.springframework.data.repository.query.Param("roleId") Long roleId);

    @org.springframework.data.jpa.repository.Query(value = "SELECT role_id FROM roles WHERE role_name = :roleName", nativeQuery = true)
    java.util.Optional<Long> findRoleIdByName(@org.springframework.data.repository.query.Param("roleName") String roleName);

    @Modifying
    @org.springframework.data.jpa.repository.Query(value = """
        INSERT INTO workspace_members (workspace_id, user_id, role_id)
        VALUES (:workspaceId, :userId, :roleId)
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id
    """, nativeQuery = true)
    void upsertWorkspaceMemberRole(@org.springframework.data.repository.query.Param("workspaceId") Long workspaceId,
                                   @org.springframework.data.repository.query.Param("userId") Long userId,
                                   @org.springframework.data.repository.query.Param("roleId") Long roleId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query(value = """
        UPDATE users SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE user_id = :userId
    """, nativeQuery = true)
    void updateUserStatus(@org.springframework.data.repository.query.Param("userId") Long userId,
                          @org.springframework.data.repository.query.Param("status") String status);
}
