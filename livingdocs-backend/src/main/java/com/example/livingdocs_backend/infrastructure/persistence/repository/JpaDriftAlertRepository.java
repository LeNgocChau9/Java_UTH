package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DriftAlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaDriftAlertRepository extends JpaRepository<DriftAlertEntity, Long> {
    List<DriftAlertEntity> findByRepoId(Long repoId);
    List<DriftAlertEntity> findByRepoIdAndPrNumber(Long repoId, Integer prNumber);
    List<DriftAlertEntity> findByStatus(String status);
}

