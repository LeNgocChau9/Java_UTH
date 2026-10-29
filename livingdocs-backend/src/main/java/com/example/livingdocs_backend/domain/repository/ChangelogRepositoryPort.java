package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.Changelog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

public interface ChangelogRepositoryPort {

    Changelog save(Changelog changelog);

    List<Changelog> findByDocumentId(Long documentId);

    List<Changelog> findAll(Long documentId, String actorRole);

    Page<Changelog> findWithFilters(String actorRole, Long repoId, Instant fromDate, Instant toDate, Pageable pageable);
}
