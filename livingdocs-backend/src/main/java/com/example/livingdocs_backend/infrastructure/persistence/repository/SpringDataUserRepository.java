package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
