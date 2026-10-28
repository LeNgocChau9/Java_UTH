package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.CiTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JpaCiTokenRepository extends JpaRepository<CiTokenEntity, Long> {
    Optional<CiTokenEntity> findByTokenHash(String tokenHash);
    List<CiTokenEntity> findByRepositoryIdOrderByCreatedAtDesc(Long repositoryId);
    List<CiTokenEntity> findAllByOrderByCreatedAtDesc();

    @Modifying
    @Query("UPDATE CiTokenEntity t SET t.isRevoked = true, t.updatedAt = CURRENT_TIMESTAMP WHERE t.tokenId = :tokenId")
    void revokeToken(@Param("tokenId") Long tokenId);
}
