package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.domain.model.CiToken;

import java.util.List;
import java.util.Optional;

public interface CiTokenRepositoryPort {
    CiToken save(CiToken ciToken);
    Optional<CiToken> findById(Long tokenId);
    Optional<CiToken> findByTokenHash(String tokenHash);
    List<CiToken> findAll();
    List<CiToken> findByRepositoryId(Long repositoryId);
    void revokeToken(Long tokenId);
}
