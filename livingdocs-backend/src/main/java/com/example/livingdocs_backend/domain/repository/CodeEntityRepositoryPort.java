package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.CodeEntity;

import java.util.List;

/**
 * Port lưu trữ và truy vấn CodeEntity (DDD / Clean Architecture).
 */
public interface CodeEntityRepositoryPort {

    CodeEntity save(CodeEntity entity);

    List<CodeEntity> saveAll(List<CodeEntity> entities);

    List<CodeEntity> findByRepositoryId(Long repositoryId);

    List<CodeEntity> findByRepositoryIdAndFilePath(Long repositoryId, String filePath);

    void deleteByRepositoryIdAndFilePath(Long repositoryId, String filePath);

    void deleteByRepositoryId(Long repositoryId);
}
