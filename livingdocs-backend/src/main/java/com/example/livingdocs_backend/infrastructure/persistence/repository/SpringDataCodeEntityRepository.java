package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataCodeEntityRepository extends JpaRepository<CodeEntityJpaEntity, Long> {

    List<CodeEntityJpaEntity> findByRepositoryId(Long repositoryId);

    List<CodeEntityJpaEntity> findByRepositoryIdAndFilePath(Long repositoryId, String filePath);

    List<CodeEntityJpaEntity> findByRepositoryIdAndDocStatus(Long repositoryId, String docStatus);

    @Modifying
    @Query("DELETE FROM CodeEntityJpaEntity c WHERE c.repositoryId = :repositoryId AND c.filePath = :filePath")
    void deleteByRepositoryIdAndFilePath(@Param("repositoryId") Long repositoryId, @Param("filePath") String filePath);

    @Modifying
    @Query("DELETE FROM CodeEntityJpaEntity c WHERE c.repositoryId = :repositoryId")
    void deleteByRepositoryId(@Param("repositoryId") Long repositoryId);
}
