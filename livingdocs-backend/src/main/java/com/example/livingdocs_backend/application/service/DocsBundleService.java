package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.infrastructure.export.DocsBundleWriter;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCollectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCollectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class DocsBundleService {

    private final SpringDataDocCollectionRepository collectionRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final SpringDataDocumentVersionRepository versionRepository;
    private final SpringDataCodeEntityRepository codeEntityRepository;

    @Autowired
    public DocsBundleService(
            SpringDataDocCollectionRepository collectionRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentVersionRepository versionRepository,
            @Autowired(required = false) SpringDataCodeEntityRepository codeEntityRepository) {
        this.collectionRepository = collectionRepository;
        this.repositoryRepository = repositoryRepository;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.codeEntityRepository = codeEntityRepository;
    }

    public byte[] exportCollection(Long collectionId) {
        DocCollectionEntity collection = collectionRepository.findById(collectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bộ sưu tập."));
        List<DocumentEntity> docs = documentRepository.findByCollectionIdOrderByUpdatedAtDesc(collectionId);
        return DocsBundleWriter.write(collection.getName(), approvedFiles(docs), null);
    }

    public byte[] exportRepository(Long repositoryId) {
        RepositoryEntity repository = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kho lưu trữ."));
        List<DocumentEntity> docs = documentRepository.findByRepoIdOrderByUpdatedAtDesc(repositoryId);
        String name = repository.getRepoFullName() != null ? repository.getRepoFullName() : repository.getRepoName();
        return DocsBundleWriter.write(name, approvedFiles(docs), openApiMarkdown(repositoryId, name));
    }

    private List<DocsBundleWriter.DocFile> approvedFiles(List<DocumentEntity> docs) {
        List<DocsBundleWriter.DocFile> files = new ArrayList<>();
        for (DocumentEntity doc : docs) {
            if (doc.getStatus() != DocumentStatus.APPROVED && doc.getStatus() != DocumentStatus.PUBLISHED) {
                continue;
            }
            String markdown = versionRepository
                    .findByDocIdAndVersionNum(doc.getDocId(), doc.getCurrentVersion() == null ? 1 : doc.getCurrentVersion())
                    .map(DocumentVersionEntity::getContent)
                    .orElseGet(() -> versionRepository.findTopByDocIdOrderByVersionNumDesc(doc.getDocId())
                            .map(DocumentVersionEntity::getContent)
                            .orElse(""));
            files.add(new DocsBundleWriter.DocFile(
                    doc.getTitle(),
                    doc.getStatus().name(),
                    doc.getTargetPath(),
                    markdown));
        }
        return files;
    }

    private String openApiMarkdown(Long repositoryId, String repoName) {
        if (codeEntityRepository == null) {
            return "";
        }
        List<CodeEntityJpaEntity> entities = codeEntityRepository.findByRepositoryId(repositoryId).stream()
                .filter(this::looksLikeApi)
                .sorted(Comparator.comparing(CodeEntityJpaEntity::getClassName, Comparator.nullsLast(String::compareTo))
                        .thenComparing(CodeEntityJpaEntity::getMethodName, Comparator.nullsLast(String::compareTo)))
                .toList();
        StringBuilder md = new StringBuilder();
        md.append("# OpenAPI Markdown\n\n");
        md.append("Danh mục API suy ra từ mã nguồn đã lập chỉ mục của `").append(repoName).append("`.\n\n");
        if (entities.isEmpty()) {
            md.append("_Chưa có lớp hoặc phương thức API trong chỉ mục mã nguồn._\n");
            return md.toString();
        }
        String currentClass = null;
        for (CodeEntityJpaEntity entity : entities) {
            String className = entity.getClassName() == null ? "API" : entity.getClassName();
            if (!className.equals(currentClass)) {
                currentClass = className;
                md.append("## ").append(className).append("\n\n");
                if (entity.getFilePath() != null) {
                    md.append("Nguồn: `").append(entity.getFilePath()).append("`\n\n");
                }
            }
            if (entity.getMethodName() == null || entity.getMethodName().isBlank()) {
                continue;
            }
            md.append("- `").append(entity.getMethodName()).append("`");
            if (entity.getSignature() != null && !entity.getSignature().isBlank()) {
                md.append(" — `").append(entity.getSignature().replace("`", "'")).append("`");
            }
            if (entity.getStartLine() != null) {
                md.append(" (dòng ").append(entity.getStartLine()).append(")");
            }
            md.append("\n");
        }
        return md.toString();
    }

    private boolean looksLikeApi(CodeEntityJpaEntity entity) {
        String type = entity.getEntityType() == null ? "" : entity.getEntityType().toUpperCase();
        String className = entity.getClassName() == null ? "" : entity.getClassName();
        String path = entity.getFilePath() == null ? "" : entity.getFilePath().toLowerCase();
        return className.endsWith("Controller")
                || className.endsWith("Resource")
                || path.contains("controller")
                || "ENDPOINT".equals(type)
                || "API".equals(type);
    }
}
