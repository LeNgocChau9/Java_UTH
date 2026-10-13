package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataCommitRepository extends JpaRepository<CommitEntity, Long> {

    List<CommitEntity> findByRepositoryId(Long repositoryId);

    Optional<CommitEntity> findByRepositoryIdAndCommitHash(Long repositoryId, String commitHash);
}
