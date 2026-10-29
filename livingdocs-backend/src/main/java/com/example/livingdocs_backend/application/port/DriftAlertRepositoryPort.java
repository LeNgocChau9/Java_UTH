package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.domain.model.DriftAlert;

import java.util.List;
import java.util.Optional;

public interface DriftAlertRepositoryPort {
    DriftAlert save(DriftAlert alert);
    List<DriftAlert> saveAll(List<DriftAlert> alerts);
    Optional<DriftAlert> findById(Long alertId);
    List<DriftAlert> findByRepoId(Long repoId);
    List<DriftAlert> findByRepoIdAndPrNumber(Long repoId, Integer prNumber);
    List<DriftAlert> findByStatus(String status);
}

