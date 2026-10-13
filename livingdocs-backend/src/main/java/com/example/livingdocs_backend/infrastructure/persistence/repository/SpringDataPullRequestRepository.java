package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataPullRequestRepository extends JpaRepository<PullRequestEntity, Long> {

    List<PullRequestEntity> findByRepositoryId(Long repositoryId);

    Optional<PullRequestEntity> findByRepositoryIdAndPrNumber(Long repositoryId, Integer prNumber);
}
