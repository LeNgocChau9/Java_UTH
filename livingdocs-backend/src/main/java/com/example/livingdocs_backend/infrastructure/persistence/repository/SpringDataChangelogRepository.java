package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ChangelogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface SpringDataChangelogRepository extends JpaRepository<ChangelogEntity, Long> {

        List<ChangelogEntity> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

        @Query("SELECT c FROM ChangelogEntity c WHERE " +
                        "(:documentId IS NULL OR c.documentId = :documentId) AND " +
                        "(:actorRole IS NULL OR c.actorRole = :actorRole) " +
                        "ORDER BY c.createdAt DESC")
        List<ChangelogEntity> findFiltered(
                        @Param("documentId") Long documentId,
                        @Param("actorRole") String actorRole);

        @Query(value = "SELECT c FROM ChangelogEntity c " +
                        "WHERE (:actorRole IS NULL OR c.actorRole = :actorRole) " +
                        "AND (:repoId IS NULL OR EXISTS (SELECT 1 FROM DocumentEntity d WHERE d.docId = c.documentId AND d.repoId = :repoId)) "
                        +
                        "AND (CAST(:fromDate AS timestamp) IS NULL OR c.createdAt >= :fromDate) " +
                        "AND (CAST(:toDate AS timestamp) IS NULL OR c.createdAt <= :toDate) " +
                        "ORDER BY c.createdAt DESC", countQuery = "SELECT COUNT(c) FROM ChangelogEntity c " +
                                        "WHERE (:actorRole IS NULL OR c.actorRole = :actorRole) " +
                                        "AND (:repoId IS NULL OR EXISTS (SELECT 1 FROM DocumentEntity d WHERE d.docId = c.documentId AND d.repoId = :repoId)) "
                                        +
                                        "AND (CAST(:fromDate AS timestamp) IS NULL OR c.createdAt >= :fromDate) " +
                                        "AND (CAST(:toDate AS timestamp) IS NULL OR c.createdAt <= :toDate)")
        Page<ChangelogEntity> findWithFilters(
                        @Param("actorRole") String actorRole,
                        @Param("repoId") Long repoId,
                        @Param("fromDate") Instant fromDate,
                        @Param("toDate") Instant toDate,
                        Pageable pageable);
}
