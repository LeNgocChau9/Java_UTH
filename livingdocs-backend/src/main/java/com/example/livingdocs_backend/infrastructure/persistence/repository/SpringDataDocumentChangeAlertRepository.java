package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataDocumentChangeAlertRepository extends JpaRepository<DocumentChangeAlertEntity, Long> {
    List<DocumentChangeAlertEntity> findByRepositoryId(Long repositoryId);
    List<DocumentChangeAlertEntity> findByRepositoryIdAndStatus(Long repositoryId, String status);
    List<DocumentChangeAlertEntity> findBySourcePrId(Long sourcePrId);
}
