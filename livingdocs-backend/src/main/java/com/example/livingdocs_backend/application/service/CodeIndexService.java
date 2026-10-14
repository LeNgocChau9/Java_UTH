package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AstExtractRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Service xử lý bóc tách AST từ AI Engine và lưu toàn bộ Code Entities vào CSDL.
 */
@Slf4j
@Service
public class CodeIndexService implements CodeIndexServicePort {

    private final CodeEntityRepositoryPort codeEntityRepository;
    private final RestClient restClient;

    public CodeIndexService(
            CodeEntityRepositoryPort codeEntityRepository,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl
    ) {
        this.codeEntityRepository = codeEntityRepository;
        this.restClient = RestClient.builder()
                .baseUrl(aiEngineUrl)
                .build();
    }

    public CodeIndexService(CodeEntityRepositoryPort codeEntityRepository, RestClient restClient) {
        this.codeEntityRepository = codeEntityRepository;
        this.restClient = restClient;
    }

    @Override
    @Transactional
    public List<CodeEntity> indexFile(Long repositoryId, String filePath, String sourceCode, String commitHash) {
        log.info("Bắt đầu bóc tách và lập chỉ mục AST cho repo={}, file={}", repositoryId, filePath);

        // 1. Gọi FastAPI /v1/ast/extract
        AstExtractResponseDto response = extractAstRaw(repositoryId, filePath, sourceCode, commitHash);

        if (response == null || response.entities() == null || response.entities().isEmpty()) {
            log.warn("Không tìm thấy entity nào từ kết quả AST cho file={}", filePath);
            return Collections.emptyList();
        }

        // 2. Xóa các entity cũ của file này trong repo để cập nhật mới nhất (idempotent)
        codeEntityRepository.deleteByRepositoryIdAndFilePath(repositoryId, filePath);

        // 3. Chuyển đổi và lưu vào CSDL
        Instant now = Instant.now();
        List<CodeEntity> domainEntities = new ArrayList<>();

        for (AstExtractResponseDto.CodeEntityItemDto item : response.entities()) {
            CodeEntity entity = CodeEntity.builder()
                    .repositoryId(repositoryId)
                    .filePath(filePath)
                    .entityType(item.entity_type())
                    .className(item.class_name())
                    .methodName(item.method_name())
                    .signature(item.signature())
                    .returnType(item.return_type())
                    .parameters(item.parameters())
                    .startLine(item.start_line())
                    .endLine(item.end_line())
                    .commitHash(commitHash != null ? commitHash : "head")
                    .docStatus(item.doc_status() != null ? item.doc_status() : "UNDOCUMENTED")
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            domainEntities.add(entity);
        }

        List<CodeEntity> saved = codeEntityRepository.saveAll(domainEntities);
        log.info("Lưu thành công {} code entities cho repo={}, file={}", saved.size(), repositoryId, filePath);
        return saved;
    }

    @Override
    public AstExtractResponseDto extractAstRaw(Long repositoryId, String filePath, String sourceCode, String commitHash) {
        AstExtractRequestDto requestDto = AstExtractRequestDto.builder()
                .repository_id(repositoryId)
                .file_path(filePath)
                .source_code(sourceCode)
                .commit_hash(commitHash)
                .build();

        try {
            return restClient.post()
                    .uri("/v1/ast/extract")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestDto)
                    .retrieve()
                    .body(AstExtractResponseDto.class);
        } catch (Exception ex) {
            log.error("Lỗi khi gọi FastAPI /v1/ast/extract cho file {}: {}", filePath, ex.getMessage(), ex);
            throw new RuntimeException("Lỗi kết nối tới AI Engine (/v1/ast/extract): " + ex.getMessage(), ex);
        }
    }

    @Override
    public List<CodeEntity> getEntitiesByRepository(Long repositoryId) {
        return codeEntityRepository.findByRepositoryId(repositoryId);
    }

    @Override
    public List<CodeEntity> getEntitiesByFile(Long repositoryId, String filePath) {
        return codeEntityRepository.findByRepositoryIdAndFilePath(repositoryId, filePath);
    }
}
