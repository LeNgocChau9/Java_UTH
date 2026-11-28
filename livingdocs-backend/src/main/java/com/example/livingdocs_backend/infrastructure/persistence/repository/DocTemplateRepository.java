package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocTemplateRepository extends JpaRepository<DocTemplate, Long> {

    boolean existsByType(String type);

    boolean existsByTypeAndIdNot(String type, Long id);

    List<DocTemplate> findByWorkspaceIdIsNull();

    @Query("SELECT t FROM DocTemplate t WHERE t.workspaceId IS NULL OR t.workspaceId = :workspaceId")
    List<DocTemplate> findAccessibleByWorkspaceId(@Param("workspaceId") Long workspaceId);

    boolean existsByTypeAndWorkspaceIdIsNull(String type);

    boolean existsByTypeAndWorkspaceId(String type, Long workspaceId);

    boolean existsByTypeAndWorkspaceIdIsNullAndIdNot(String type, Long id);

    boolean existsByTypeAndWorkspaceIdAndIdNot(String type, Long workspaceId, Long id);
}
