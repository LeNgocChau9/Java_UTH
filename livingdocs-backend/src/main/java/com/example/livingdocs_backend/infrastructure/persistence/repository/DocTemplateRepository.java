package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocTemplateRepository extends JpaRepository<DocTemplate, Long> {

    boolean existsByType(String type);

    boolean existsByTypeAndIdNot(String type, Long id);
}
