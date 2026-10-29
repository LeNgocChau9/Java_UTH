package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ChangelogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataChangelogRepository extends JpaRepository<ChangelogEntity, Long> {

    List<ChangelogEntity> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

    @Query("SELECT c FROM ChangelogEntity c WHERE " +
           "(:documentId IS NULL OR c.documentId = :documentId) AND " +
           "(:actorRole IS NULL OR UPPER(c.actorRole) = UPPER(:actorRole)) " +
           "ORDER BY c.createdAt DESC")
    List<ChangelogEntity> findFiltered(
            @Param("documentId") Long documentId,
            @Param("actorRole") String actorRole
    );
}
