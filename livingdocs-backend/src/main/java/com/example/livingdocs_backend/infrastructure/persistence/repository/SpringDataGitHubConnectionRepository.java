package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataGitHubConnectionRepository extends JpaRepository<GitHubConnectionEntity, Long> {

    Optional<GitHubConnectionEntity> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);

    Optional<GitHubConnectionEntity> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<GitHubConnectionEntity> findFirstByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);

    java.util.List<GitHubConnectionEntity> findByWorkspaceId(Long workspaceId);

    java.util.List<GitHubConnectionEntity> findByUserId(Long userId);

    java.util.List<GitHubConnectionEntity> findAllByStatus(String status);
}

