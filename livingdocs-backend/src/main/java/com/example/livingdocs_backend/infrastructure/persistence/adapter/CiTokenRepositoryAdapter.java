package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.application.port.CiTokenRepositoryPort;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CiTokenEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.JpaCiTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class CiTokenRepositoryAdapter implements CiTokenRepositoryPort {

    private final JpaCiTokenRepository jpaCiTokenRepository;

    @Override
    public CiToken save(CiToken ciToken) {
        CiTokenEntity entity = toEntity(ciToken);
        CiTokenEntity saved = jpaCiTokenRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<CiToken> findById(Long tokenId) {
        return jpaCiTokenRepository.findById(tokenId).map(this::toDomain);
    }

    @Override
    public Optional<CiToken> findByTokenHash(String tokenHash) {
        return jpaCiTokenRepository.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    public List<CiToken> findAll() {
        return jpaCiTokenRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<CiToken> findByRepositoryId(Long repositoryId) {
        return jpaCiTokenRepository.findByRepositoryIdOrderByCreatedAtDesc(repositoryId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void revokeToken(Long tokenId) {
        jpaCiTokenRepository.revokeToken(tokenId);
    }

    private CiToken toDomain(CiTokenEntity entity) {
        if (entity == null) return null;
        return CiToken.builder()
                .tokenId(entity.getTokenId())
                .tokenName(entity.getTokenName())
                .tokenHash(entity.getTokenHash())
                .tokenPrefix(entity.getTokenPrefix())
                .createdByUserId(entity.getCreatedByUserId())
                .repositoryId(entity.getRepositoryId())
                .description(entity.getDescription())
                .isRevoked(entity.isRevoked())
                .expiresAt(entity.getExpiresAt())
                .lastUsedAt(entity.getLastUsedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private CiTokenEntity toEntity(CiToken domain) {
        if (domain == null) return null;
        return CiTokenEntity.builder()
                .tokenId(domain.getTokenId())
                .tokenName(domain.getTokenName())
                .tokenHash(domain.getTokenHash())
                .tokenPrefix(domain.getTokenPrefix())
                .createdByUserId(domain.getCreatedByUserId())
                .repositoryId(domain.getRepositoryId())
                .description(domain.getDescription())
                .isRevoked(domain.isRevoked())
                .expiresAt(domain.getExpiresAt())
                .lastUsedAt(domain.getLastUsedAt())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }
}
