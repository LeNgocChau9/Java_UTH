package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentUpdatePolicyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataDocumentUpdatePolicyRepository extends JpaRepository<DocumentUpdatePolicyEntity, Long> {
    Optional<DocumentUpdatePolicyEntity> findByDocumentType(String documentType);
}
