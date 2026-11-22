package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangePolicyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataDocumentChangePolicyRepository extends JpaRepository<DocumentChangePolicyEntity, Long> {
    List<DocumentChangePolicyEntity> findByRepositoryId(Long repositoryId);
    List<DocumentChangePolicyEntity> findByWorkspaceId(Long workspaceId);
    List<DocumentChangePolicyEntity> findByDocumentType(String documentType);
}
