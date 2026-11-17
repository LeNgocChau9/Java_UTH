package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ExternalIntegrationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataExternalIntegrationRepository extends JpaRepository<ExternalIntegrationEntity, Long> {

    List<ExternalIntegrationEntity> findByWorkspaceIdOrderByProviderAsc(Long workspaceId);

    Optional<ExternalIntegrationEntity> findByProviderAndWorkspaceId(String provider, Long workspaceId);

    List<ExternalIntegrationEntity> findByWorkspaceIdAndEnabledTrue(Long workspaceId);
}
