package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@RequiredArgsConstructor
public class CodeEntityRepositoryAdapter implements CodeEntityRepositoryPort {

    private final SpringDataCodeEntityRepository repository;

    @Override
    @Transactional
    public CodeEntity save(CodeEntity entity) {
        CodeEntityJpaEntity jpa = toJpaEntity(entity);
        CodeEntityJpaEntity saved = repository.save(jpa);
        return toDomain(saved);
    }

    @Override
    @Transactional
    public List<CodeEntity> saveAll(List<CodeEntity> entities) {
        List<CodeEntityJpaEntity> jpaList = entities.stream().map(this::toJpaEntity).toList();
        List<CodeEntityJpaEntity> savedList = repository.saveAll(jpaList);
        return savedList.stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CodeEntity> findByRepositoryId(Long repositoryId) {
        return repository.findByRepositoryId(repositoryId).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CodeEntity> findByRepositoryIdAndFilePath(Long repositoryId, String filePath) {
        return repository.findByRepositoryIdAndFilePath(repositoryId, filePath).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional
    public void deleteByRepositoryIdAndFilePath(Long repositoryId, String filePath) {
        repository.deleteByRepositoryIdAndFilePath(repositoryId, filePath);
    }

    @Override
    @Transactional
    public void deleteByRepositoryId(Long repositoryId) {
        repository.deleteByRepositoryId(repositoryId);
    }

    private CodeEntityJpaEntity toJpaEntity(CodeEntity d) {
        return CodeEntityJpaEntity.builder()
                .entityId(d.getEntityId())
                .repositoryId(d.getRepositoryId())
                .filePath(d.getFilePath())
                .entityType(d.getEntityType())
                .className(d.getClassName())
                .methodName(d.getMethodName())
                .signature(d.getSignature())
                .returnType(d.getReturnType())
                .parameters(d.getParameters())
                .startLine(d.getStartLine())
                .endLine(d.getEndLine())
                .commitHash(d.getCommitHash())
                .docStatus(d.getDocStatus() != null ? d.getDocStatus() : "UNDOCUMENTED")
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .build();
    }

    private CodeEntity toDomain(CodeEntityJpaEntity j) {
        return CodeEntity.builder()
                .entityId(j.getEntityId())
                .repositoryId(j.getRepositoryId())
                .filePath(j.getFilePath())
                .entityType(j.getEntityType())
                .className(j.getClassName())
                .methodName(j.getMethodName())
                .signature(j.getSignature())
                .returnType(j.getReturnType())
                .parameters(j.getParameters())
                .startLine(j.getStartLine())
                .endLine(j.getEndLine())
                .commitHash(j.getCommitHash())
                .docStatus(j.getDocStatus())
                .createdAt(j.getCreatedAt())
                .updatedAt(j.getUpdatedAt())
                .build();
    }
}
