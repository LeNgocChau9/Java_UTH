package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.Changelog;

import java.util.List;

public interface ChangelogRepositoryPort {

    Changelog save(Changelog changelog);

    List<Changelog> findByDocumentId(Long documentId);

    List<Changelog> findAll(Long documentId, String actorRole);
}
