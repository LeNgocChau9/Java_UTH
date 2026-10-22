package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentTemplateVersionRepository extends JpaRepository<DocumentTemplateVersion, Long> {

    List<DocumentTemplateVersion> findByTemplateIdOrderByVersionNumDesc(Long templateId);

    Optional<DocumentTemplateVersion> findByVersionIdAndTemplateId(Long versionId, Long templateId);

    Optional<DocumentTemplateVersion> findFirstByTemplateIdOrderByVersionNumDesc(Long templateId);

    void deleteByTemplateId(Long templateId);
}
