package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataRepositoryRepository extends JpaRepository<RepositoryEntity, Long> {

    List<RepositoryEntity> findByWorkspaceId(Long workspaceId);

    Optional<RepositoryEntity> findByWorkspaceIdAndGithubRepoId(Long workspaceId, Long githubRepoId);

    Optional<RepositoryEntity> findByWorkspaceIdAndRepoFullName(Long workspaceId, String repoFullName);
}
