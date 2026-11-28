package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.WebhookDeliveryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataWebhookDeliveryRepository extends JpaRepository<WebhookDeliveryEntity, Long> {

    List<WebhookDeliveryEntity> findTop100ByRepositoryIdOrderByDeliveredAtDesc(Long repositoryId);

    List<WebhookDeliveryEntity> findTop100ByWorkspaceIdOrderByDeliveredAtDesc(Long workspaceId);

    List<WebhookDeliveryEntity> findTop100ByOrderByDeliveredAtDesc();
}
