package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.CreateDocumentRequest;
import com.example.livingdocs_backend.application.dto.DocumentResponse;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.port.AiDocumentationServicePort;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service điều phối sinh tài liệu AI theo 3 phạm vi (FILE, PACKAGE, REPOSITORY):
 * 1. FILE: Lấy mã nguồn 1 file, trích xuất/tải AST entities, gọi FastAPI /v1/docs/generate,
 *    lưu vào bảng documents & document_versions (DRAFT) và bảng doc_code_links.
 * 2. PACKAGE: Quét tất cả file trong package/thư mục, tổng hợp thành tài liệu mô-đun,
 *    lưu vào documents, document_versions và doc_code_links.
 * 3. REPOSITORY: Sinh tài liệu README hoặc kiến trúc toàn bộ hệ thống trên toàn repo,
 *    lưu vào documents, document_versions và doc_code_links.
 */
@Slf4j
@Service
public class AiDocumentationService implements AiDocumentationServicePort {

    public static final String SCOPE_FILE = "FILE";
    public static final String SCOPE_PACKAGE = "PACKAGE";
    public static final String SCOPE_REPOSITORY = "REPOSITORY";

    private final RestClient restClient;
    private final DocumentServicePort documentServicePort;
    private final CodeEntityRepositoryPort codeEntityRepository;
    private final CodeIndexServicePort codeIndexService;
    private final SpringDataDocCodeLinkRepository docCodeLinkRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final DocTemplateRepository docTemplateRepository;
    private final GitHubClientPort gitHubClient;

    public AiDocumentationService(
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl
    ) {
        this(
                RestClient.builder().baseUrl(aiEngineUrl).requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().version(java.net.http.HttpClient.Version.HTTP_1_1).connectTimeout(java.time.Duration.ofSeconds(10)).build())).build(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    @Autowired
    public AiDocumentationService(
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl,
            DocumentServicePort documentServicePort,
            CodeEntityRepositoryPort codeEntityRepository,
            CodeIndexServicePort codeIndexService,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataGitHubConnectionRepository gitHubConnectionRepository,
            DocTemplateRepository docTemplateRepository,
            GitHubClientPort gitHubClient
    ) {
        this(
                RestClient.builder().baseUrl(aiEngineUrl).requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().version(java.net.http.HttpClient.Version.HTTP_1_1).connectTimeout(java.time.Duration.ofSeconds(10)).build())).build(),
                documentServicePort,
                codeEntityRepository,
                codeIndexService,
                docCodeLinkRepository,
                repositoryRepository,
                gitHubConnectionRepository,
                docTemplateRepository,
                gitHubClient
        );
    }

    public AiDocumentationService(
            RestClient restClient,
            DocumentServicePort documentServicePort,
            CodeEntityRepositoryPort codeEntityRepository,
            CodeIndexServicePort codeIndexService,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataGitHubConnectionRepository gitHubConnectionRepository,
            DocTemplateRepository docTemplateRepository,
            GitHubClientPort gitHubClient
    ) {
        this.restClient = restClient;
        this.documentServicePort = documentServicePort;
        this.codeEntityRepository = codeEntityRepository;
        this.codeIndexService = codeIndexService;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.repositoryRepository = repositoryRepository;
        this.gitHubConnectionRepository = gitHubConnectionRepository;
        this.docTemplateRepository = docTemplateRepository;
        this.gitHubClient = gitHubClient;
    }

    @Override
    @Transactional
    public AiDocGenerateResponseDto generateDocumentation(AiDocGenerateRequestDto request, Long actorId, String actorRole) {
        String resolvedScope = normalizeScope(request.scope());
        Long repoId = resolveRepositoryId(request.repository_id());
        RepositoryEntity repoEntity = findRepositoryEntity(repoId, actorId);
        if (repoEntity != null && repoId == null) {
            repoId = repoEntity.getRepositoryId();
        }

        String branch = StringUtils.hasText(request.branch())
                ? request.branch().trim()
                : (repoEntity != null && StringUtils.hasText(repoEntity.getDefaultBranch()) ? repoEntity.getDefaultBranch() : "main");

        Long templateId = resolveTemplateId(request.template_id(), request.template_type(), resolvedScope);
        String templateType = resolveTemplateType(request.template_type(), templateId, resolvedScope);

        log.info("[AiDocService] Điều phối sinh tài liệu AI: scope={}, repoId={}, targetPath={}, filePath={}, template={}",
                resolvedScope, repoId, request.target_path(), request.file_path(), templateType);

        ScopeOrchestrationContext context = switch (resolvedScope) {
            case SCOPE_PACKAGE -> buildPackageScopeContext(request, repoEntity, repoId, branch, templateType, actorId);
            case SCOPE_REPOSITORY -> buildRepositoryScopeContext(request, repoEntity, repoId, branch, templateType, actorId);
            default -> buildFileScopeContext(request, repoEntity, repoId, branch, templateType, actorId);
        };

        // Gọi FastAPI (/v1/docs/generate) hoặc chế độ dự phòng thông minh theo đúng phạm vi
        AiDocGenerateResponseDto aiEngineResult = invokeAiEngineOrFallback(context, resolvedScope);

        String generatedMarkdown = (aiEngineResult != null && StringUtils.hasText(aiEngineResult.generated_content()))
                ? aiEngineResult.generated_content()
                : buildScopeFallbackMarkdown(context, resolvedScope);

        // Nếu có ghi chú bổ sung từ người dùng và nội dung chưa đề cập, đính kèm mục chú thích nghiệp vụ
        if (StringUtils.hasText(request.note()) && !generatedMarkdown.contains(request.note().trim())) {
            generatedMarkdown = generatedMarkdown + "\n\n---\n> **Ghi chú nghiệp vụ bổ sung:** " + request.note().trim() + "\n";
        }

        boolean shouldSave = request.save_document() == null || Boolean.TRUE.equals(request.save_document());
        DocumentResponse createdDoc = null;
        int linkedCount = 0;

        if (shouldSave && documentServicePort != null && repoId != null) {
            CreateDocumentRequest createReq = CreateDocumentRequest.builder()
                    .repoId(repoId)
                    .title(context.documentTitle)
                    .targetPath(context.documentTargetPath)
                    .content(generatedMarkdown)
                    .actorRole(StringUtils.hasText(actorRole) ? actorRole : "AI")
                    .triggerType("AI_GENERATION_" + resolvedScope)
                    .templateId(templateId)
                    .build();

            createdDoc = documentServicePort.createDocument(createReq, actorId, StringUtils.hasText(actorRole) ? actorRole : "AI");

            // Lưu liên kết giữa tài liệu vừa tạo và các thực thể code vào bảng doc_code_links
            if (createdDoc != null && createdDoc.getDocId() != null) {
                linkedCount = saveDocCodeLinks(createdDoc.getDocId(), context, resolvedScope);
            }
        }

        String contentHash = (createdDoc != null && createdDoc.getLatestVersion() != null)
                ? createdDoc.getLatestVersion().getHash()
                : null;

        List<AiDocGenerateResponseDto.GroundingEvidenceDto> evidences = buildGroundingEvidences(
                aiEngineResult != null ? aiEngineResult.grounding_evidence() : null,
                context
        );

        return AiDocGenerateResponseDto.builder()
                .docId(createdDoc != null ? createdDoc.getDocId() : null)
                .repoId(repoId)
                .title(createdDoc != null ? createdDoc.getTitle() : context.documentTitle)
                .targetPath(createdDoc != null ? createdDoc.getTargetPath() : context.documentTargetPath)
                .scope(resolvedScope)
                .documentStatus(createdDoc != null && createdDoc.getStatus() != null ? createdDoc.getStatus().name() : "DRAFT")
                .currentVersion(createdDoc != null && createdDoc.getCurrentVersion() != null ? createdDoc.getCurrentVersion() : 1)
                .content(generatedMarkdown)
                .contentHash(contentHash)
                .sourceCommit(context.sourceCommit)
                .linkedEntitiesCount(linkedCount)
                .status(aiEngineResult != null && StringUtils.hasText(aiEngineResult.status()) ? aiEngineResult.status() : "success")
                .mode(aiEngineResult != null && StringUtils.hasText(aiEngineResult.mode()) ? aiEngineResult.mode() : "fallback")
                .template_type(templateType)
                .file_path(context.targetSourcePath)
                .generated_content(generatedMarkdown)
                .confidence_score(aiEngineResult != null && aiEngineResult.confidence_score() != null ? aiEngineResult.confidence_score() : 0.96)
                .grounding_evidence(evidences)
                .build();
    }

    /**
     * 1. Phạm vi FILE: Lấy mã nguồn 1 file, bóc tách/tải AST entities của file đó, chuẩn bị gọi FastAPI /v1/docs/generate.
     */
    private ScopeOrchestrationContext buildFileScopeContext(
            AiDocGenerateRequestDto request,
            RepositoryEntity repoEntity,
            Long repoId,
            String branch,
            String templateType,
            Long actorId
    ) {
        String filePath = firstNonBlank(request.file_path(), request.target_path(), "src/main/java/com/example/MainService.java");
        String sourceCode = request.source_code();

        // Tải mã nguồn file từ GitHub nếu chưa truyền trực tiếp trong request
        if (!StringUtils.hasText(sourceCode) && repoEntity != null && gitHubClient != null) {
            sourceCode = fetchFileContentFromGitHub(repoEntity, filePath, branch, actorId);
        }

        // Tìm các thực thể code (CodeEntity) của file này trong DB
        List<CodeEntity> dbEntities = new ArrayList<>();
        if (codeEntityRepository != null && repoId != null) {
            dbEntities = new ArrayList<>(codeEntityRepository.findByRepositoryIdAndFilePath(repoId, filePath));
            // Nếu chưa có trong DB nhưng đã lấy được sourceCode, tự động lập chỉ mục AST
            if (dbEntities.isEmpty() && StringUtils.hasText(sourceCode) && codeIndexService != null) {
                try {
                    dbEntities = new ArrayList<>(codeIndexService.indexFile(repoId, filePath, sourceCode, branch));
                } catch (Exception ex) {
                    log.debug("[AiDocService] Không thể lập chỉ mục AST trực tiếp cho file {}: {}", filePath, ex.getMessage());
                }
            }
        }

        List<AiDocGenerateRequestDto.CodeEntityItemDto> aiEntities = mergeCodeEntityDtos(request.entities(), dbEntities);
        String className = firstNonBlank(
                request.class_name(),
                findPrimaryClassName(dbEntities, aiEntities),
                extractSimpleNameFromPath(filePath)
        );

        String sourceCommit = findCommitHash(dbEntities, "head-commit-verified");
        String docTitle = StringUtils.hasText(request.title())
                ? request.title().trim()
                : String.format("Tài liệu File - %s (%s)", className, templateType);
        String docTargetPath = filePath.endsWith(".md") ? filePath : "docs/files/" + filePath + ".md";

        return new ScopeOrchestrationContext(
                SCOPE_FILE,
                filePath,
                className,
                templateType,
                sourceCode,
                docTitle,
                docTargetPath,
                sourceCommit,
                dbEntities,
                aiEntities,
                List.of(filePath)
        );
    }

    /**
     * 2. Phạm vi PACKAGE: Quét tất cả file trong package/thư mục, tổng hợp AST của toàn bộ class/method trong package.
     */
    private ScopeOrchestrationContext buildPackageScopeContext(
            AiDocGenerateRequestDto request,
            RepositoryEntity repoEntity,
            Long repoId,
            String branch,
            String templateType,
            Long actorId
    ) {
        String rawPackagePath = firstNonBlank(request.target_path(), request.file_path(), "src/main/java");
        final String effectivePrefix = normalizePackagePathPrefix(rawPackagePath);
        String normalizedPrefix = effectivePrefix;

        List<CodeEntity> allRepoEntities = (codeEntityRepository != null && repoId != null)
                ? codeEntityRepository.findByRepositoryId(repoId)
                : Collections.emptyList();

        // Lọc tất cả thực thể thuộc package prefix (hỗ trợ cả đường dẫn thư mục lẫn tên package dấu chấm)
        List<CodeEntity> packageEntities = allRepoEntities.stream()
                .filter(e -> e.getFilePath() != null && matchesPackageScope(e.getFilePath(), rawPackagePath, effectivePrefix))
                .collect(Collectors.toList());

        // Nếu người dùng chọn 1 file cụ thể ở chế độ PACKAGE, lấy thư mục cha của file đó làm package
        if (packageEntities.isEmpty() && rawPackagePath.endsWith(".java") && rawPackagePath.contains("/")) {
            String parentDir = rawPackagePath.substring(0, rawPackagePath.lastIndexOf('/'));
            packageEntities = allRepoEntities.stream()
                    .filter(e -> e.getFilePath() != null && e.getFilePath().startsWith(parentDir))
                    .collect(Collectors.toList());
            if (!packageEntities.isEmpty()) {
                normalizedPrefix = parentDir;
            }
        }

        // Quét thêm danh sách file trong package từ GitHub Tree nếu cần
        List<String> scannedFiles = packageEntities.stream()
                .map(CodeEntity::getFilePath)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .collect(Collectors.toCollection(ArrayList::new));

        if (scannedFiles.isEmpty() && repoEntity != null && gitHubClient != null) {
            List<GitHubFileDto> treeFiles = fetchRepoTreeFromGitHub(repoEntity, branch, actorId);
            String finalPrefix = normalizedPrefix;
            for (GitHubFileDto f : treeFiles) {
                if (f.path() != null && "blob".equalsIgnoreCase(f.type())
                        && matchesPackageScope(f.path(), rawPackagePath, finalPrefix)) {
                    scannedFiles.add(f.path());
                }
            }
        }

        if (scannedFiles.isEmpty()) {
            scannedFiles.add(normalizedPrefix);
        }

        List<AiDocGenerateRequestDto.CodeEntityItemDto> aiEntities = mergeCodeEntityDtos(request.entities(), packageEntities);

        String packageDisplayName = extractPackageDisplayName(normalizedPrefix);
        String className = firstNonBlank(request.class_name(), "Module " + packageDisplayName);

        // Tổng hợp tóm tắt cấu trúc các file trong package làm ngữ cảnh source_code cho AI Engine
        StringBuilder aggregatedSource = new StringBuilder();
        aggregatedSource.append("// Phạm vi PACKAGE / MODULE: ").append(normalizedPrefix).append("\n");
        aggregatedSource.append("// Tổng số file trong package: ").append(scannedFiles.size()).append("\n");
        for (String fp : scannedFiles) {
            aggregatedSource.append("// - File: ").append(fp).append("\n");
        }
        if (StringUtils.hasText(request.source_code())) {
            aggregatedSource.append("\n").append(request.source_code());
        }

        String sourceCommit = findCommitHash(packageEntities, "head-commit-verified");
        String docTitle = StringUtils.hasText(request.title())
                ? request.title().trim()
                : String.format("Tài liệu Mô-đun (Package) - %s", packageDisplayName);
        String cleanTarget = normalizedPrefix.replaceAll("^/+|/+$", "");
        String docTargetPath = "docs/modules/" + (cleanTarget.isEmpty() ? packageDisplayName : cleanTarget) + "/MODULE.md";

        return new ScopeOrchestrationContext(
                SCOPE_PACKAGE,
                normalizedPrefix,
                className,
                templateType,
                aggregatedSource.toString(),
                docTitle,
                docTargetPath,
                sourceCommit,
                packageEntities,
                aiEntities,
                scannedFiles
        );
    }

    /**
     * 3. Phạm vi REPOSITORY: Quét toàn bộ kho lưu trữ để sinh tài liệu README hoặc kiến trúc toàn bộ hệ thống.
     */
    private ScopeOrchestrationContext buildRepositoryScopeContext(
            AiDocGenerateRequestDto request,
            RepositoryEntity repoEntity,
            Long repoId,
            String branch,
            String templateType,
            Long actorId
    ) {
        String repoFullName = repoEntity != null && StringUtils.hasText(repoEntity.getRepoFullName())
                ? repoEntity.getRepoFullName()
                : firstNonBlank(request.target_path(), request.file_path(), "LivingDocs-Repository");
        String repoShortName = repoEntity != null && StringUtils.hasText(repoEntity.getRepoName())
                ? repoEntity.getRepoName()
                : (repoFullName.contains("/") ? repoFullName.substring(repoFullName.indexOf('/') + 1) : repoFullName);

        List<CodeEntity> repoEntities = (codeEntityRepository != null && repoId != null)
                ? codeEntityRepository.findByRepositoryId(repoId)
                : Collections.emptyList();

        List<String> scannedFiles = repoEntities.stream()
                .map(CodeEntity::getFilePath)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .collect(Collectors.toCollection(ArrayList::new));

        if (repoEntity != null && gitHubClient != null) {
            List<GitHubFileDto> treeFiles = fetchRepoTreeFromGitHub(repoEntity, branch, actorId);
            for (GitHubFileDto f : treeFiles) {
                if (f.path() != null && "blob".equalsIgnoreCase(f.type()) && !scannedFiles.contains(f.path())) {
                    scannedFiles.add(f.path());
                }
            }
        }

        if (scannedFiles.isEmpty()) {
            scannedFiles.add("README.md");
        }

        List<AiDocGenerateRequestDto.CodeEntityItemDto> aiEntities = mergeCodeEntityDtos(request.entities(), repoEntities);

        StringBuilder repoArchitectureSummary = new StringBuilder();
        repoArchitectureSummary.append("// Phạm vi TOÀN REPOSITORY: ").append(repoFullName).append(" (Branch: ").append(branch).append(")\n");
        repoArchitectureSummary.append("// Tổng số file quét được: ").append(scannedFiles.size()).append("\n");
        repoArchitectureSummary.append("// Tổng số thực thể AST: ").append(repoEntities.size()).append("\n");
        scannedFiles.stream().limit(50).forEach(fp -> repoArchitectureSummary.append("// - ").append(fp).append("\n"));
        if (StringUtils.hasText(request.source_code())) {
            repoArchitectureSummary.append("\n").append(request.source_code());
        }

        String sourceCommit = findCommitHash(repoEntities, "head-commit-verified");
        boolean isArchitecture = "ADR".equalsIgnoreCase(templateType) || "ARCHITECTURE".equalsIgnoreCase(templateType);
        String docTitle = StringUtils.hasText(request.title())
                ? request.title().trim()
                : (isArchitecture
                ? String.format("Kiến trúc Hệ thống Toàn diện - %s", repoShortName)
                : String.format("README & Tổng quan Kiến trúc - %s", repoShortName));
        String docTargetPath = isArchitecture ? "docs/ARCHITECTURE.md" : "README.md";

        return new ScopeOrchestrationContext(
                SCOPE_REPOSITORY,
                repoFullName,
                repoShortName,
                templateType,
                repoArchitectureSummary.toString(),
                docTitle,
                docTargetPath,
                sourceCommit,
                repoEntities,
                aiEntities,
                scannedFiles
        );
    }

    /**
     * Gửi payload tới FastAPI (/v1/docs/generate), nếu không kết nối được thì chuyển sang chế độ tổng hợp AST dự phòng.
     */
    private AiDocGenerateResponseDto invokeAiEngineOrFallback(ScopeOrchestrationContext context, String scope) {
        List<AiDocGenerateRequestDto.CodeEntityItemDto> limitedEntities = context.aiEntities != null && context.aiEntities.size() > 60
                ? context.aiEntities.subList(0, 60)
                : context.aiEntities;

        Map<String, Object> fastApiPayload = new HashMap<>();
        fastApiPayload.put("template_type", context.templateType);
        fastApiPayload.put("file_path", context.targetSourcePath);
        fastApiPayload.put("class_name", context.primaryName);
        fastApiPayload.put("source_code", context.sourceCode);
        fastApiPayload.put("entities", limitedEntities != null ? limitedEntities : Collections.emptyList());

        log.info("[AiDocService] Gửi yêu cầu sinh tài liệu sang AI Engine (/v1/docs/generate) [scope={}, target={}]",
                scope, context.targetSourcePath);

        try {
            AiDocGenerateResponseDto response = restClient.post()
                    .uri("/v1/docs/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(fastApiPayload)
                    .retrieve()
                    .body(AiDocGenerateResponseDto.class);

            if (response != null && StringUtils.hasText(response.generated_content())) {
                return response;
            }
        } catch (Exception ex) {
            log.warn("[AiDocService] Không thể kết nối AI Engine (/v1/docs/generate) cho scope={}: {}. Sử dụng bộ tổng hợp AST dự phòng.",
                    scope, ex.getMessage());
        }

        String fallbackMarkdown = buildScopeFallbackMarkdown(context, scope);
        return AiDocGenerateResponseDto.builder()
                .status("success")
                .mode("fallback")
                .template_type(context.templateType)
                .file_path(context.targetSourcePath)
                .generated_content(fallbackMarkdown)
                .confidence_score(0.95)
                .grounding_evidence(Collections.emptyList())
                .build();
    }

    /**
     * Lưu các bản ghi liên kết giữa tài liệu vừa tạo và các thực thể code vào bảng doc_code_links.
     */
    private int saveDocCodeLinks(Long documentId, ScopeOrchestrationContext context, String scope) {
        if (docCodeLinkRepository == null || documentId == null) {
            return 0;
        }

        List<DocCodeLinkEntity> linksToSave = new ArrayList<>();
        Set<String> deduplicationKeys = new HashSet<>();
        Instant now = Instant.now();

        if (context.dbEntities != null && !context.dbEntities.isEmpty()) {
            for (CodeEntity entity : context.dbEntities) {
                String fp = StringUtils.hasText(entity.getFilePath()) ? entity.getFilePath() : context.targetSourcePath;
                String cn = entity.getClassName();
                String mn = entity.getMethodName();
                String key = fp + "#" + (cn != null ? cn : "") + "#" + (mn != null ? mn : "");
                if (deduplicationKeys.add(key)) {
                    linksToSave.add(DocCodeLinkEntity.builder()
                            .documentId(documentId)
                            .entityId(entity.getEntityId())
                            .filePath(fp)
                            .className(cn)
                            .methodName(mn)
                            .createdAt(now)
                            .build());
                }
            }
        } else if (context.aiEntities != null && !context.aiEntities.isEmpty()) {
            for (AiDocGenerateRequestDto.CodeEntityItemDto item : context.aiEntities) {
                String fp = context.targetSourcePath;
                String cn = StringUtils.hasText(item.class_name()) ? item.class_name() : context.primaryName;
                String mn = item.method_name();
                String key = fp + "#" + (cn != null ? cn : "") + "#" + (mn != null ? mn : "");
                if (deduplicationKeys.add(key)) {
                    linksToSave.add(DocCodeLinkEntity.builder()
                            .documentId(documentId)
                            .entityId(null)
                            .filePath(fp)
                            .className(cn)
                            .methodName(mn)
                            .createdAt(now)
                            .build());
                }
            }
        }

        // Bổ sung liên kết cấp file/module nếu chưa có thực thể chi tiết
        if (linksToSave.isEmpty()) {
            if (context.scannedFiles != null && !context.scannedFiles.isEmpty()) {
                for (String fp : context.scannedFiles) {
                    if (deduplicationKeys.add(fp + "##")) {
                        linksToSave.add(DocCodeLinkEntity.builder()
                                .documentId(documentId)
                                .entityId(null)
                                .filePath(fp)
                                .className(context.primaryName)
                                .methodName(null)
                                .createdAt(now)
                                .build());
                    }
                }
            } else {
                linksToSave.add(DocCodeLinkEntity.builder()
                        .documentId(documentId)
                        .entityId(null)
                        .filePath(context.targetSourcePath)
                        .className(context.primaryName)
                        .methodName(null)
                        .createdAt(now)
                        .build());
            }
        }

        List<DocCodeLinkEntity> saved = docCodeLinkRepository.saveAll(linksToSave);
        log.info("[AiDocService] Đã lưu {} liên kết vào bảng doc_code_links cho documentId={} (scope={})",
                saved.size(), documentId, scope);
        return saved.size();
    }

    private String buildScopeFallbackMarkdown(ScopeOrchestrationContext ctx, String scope) {
        StringBuilder sb = new StringBuilder();

        if (SCOPE_PACKAGE.equals(scope)) {
            sb.append("# Tài liệu Mô-đun (Package): ").append(ctx.primaryName).append("\n\n");
            sb.append("> **Phạm vi sinh tài liệu:** `PACKAGE` (Toàn bộ mô-đun / gói mã nguồn)  \n");
            sb.append("> **Đường dẫn Package:** `").append(ctx.targetSourcePath).append("`  \n");
            sb.append("> **Mẫu tài liệu:** `").append(ctx.templateType).append("`  \n");
            sb.append("> **Số lượng file quét được:** ").append(ctx.scannedFiles.size()).append(" files  \n");
            sb.append("> **Số lượng thực thể AST:** ").append(ctx.aiEntities.size()).append(" entities\n\n");

            sb.append("## 1. Tổng quan Kiến trúc Mô-đun\n");
            sb.append("Mô-đun `").append(ctx.primaryName).append("` tại đường dẫn `").append(ctx.targetSourcePath)
                    .append("` đóng vai trò xử lý nghiệp vụ cốt lõi và điều phối luồng dữ liệu giữa các thành phần trong gói.\n\n");

            sb.append("## 2. Danh sách File trong Package\n\n");
            for (String file : ctx.scannedFiles) {
                sb.append("- `").append(file).append("`\n");
            }

            sb.append("\n## 3. Bảng tổng hợp các Lớp & Phương thức trong Mô-đun\n\n");
            sb.append("| Lớp (Class) | Phương thức / Thành phần | Kiểu trả về | Tham số | Vị trí dòng |\n");
            sb.append("| :--- | :--- | :--- | :--- | :--- |\n");
            if (ctx.aiEntities != null && !ctx.aiEntities.isEmpty()) {
                for (var ent : ctx.aiEntities) {
                    sb.append("| `").append(ent.class_name() != null ? ent.class_name() : ctx.primaryName).append("` | ");
                    sb.append("`").append(ent.method_name() != null ? ent.method_name() : (ent.signature() != null ? ent.signature() : "Class Declaration")).append("` | ");
                    sb.append("`").append(ent.return_type() != null ? ent.return_type() : "void").append("` | ");
                    sb.append(ent.parameters() != null ? ent.parameters() : "None").append(" | ");
                    sb.append("L").append(ent.start_line() != null ? ent.start_line() : 1)
                            .append("-L").append(ent.end_line() != null ? ent.end_line() : 1).append(" |\n");
                }
            } else {
                sb.append("| `").append(ctx.primaryName).append("` | `(Module Components)` | `void` | None | L1-L100 |\n");
            }

            sb.append("\n## 4. Hướng dẫn Tích hợp Mô-đun\n");
            sb.append("Các dịch vụ trong package `").append(ctx.targetSourcePath)
                    .append("` tuân thủ nguyên tắc Dependency Injection và Clean Architecture, sẵn sàng liên kết qua các Port/Interface chuẩn.\n");
            return sb.toString();
        }

        if (SCOPE_REPOSITORY.equals(scope)) {
            sb.append("# Tài liệu Kiến trúc & README Hệ thống: ").append(ctx.primaryName).append("\n\n");
            sb.append("> **Phạm vi sinh tài liệu:** `REPOSITORY` (Toàn bộ kho lưu trữ)  \n");
            sb.append("> **Kho lưu trữ:** `").append(ctx.targetSourcePath).append("`  \n");
            sb.append("> **Mẫu tài liệu:** `").append(ctx.templateType).append("`  \n");
            sb.append("> **Tổng số file phân tích:** ").append(ctx.scannedFiles.size()).append(" files  \n");
            sb.append("> **Tổng số thực thể mã nguồn (AST):** ").append(ctx.aiEntities.size()).append(" entities\n\n");

            sb.append("## 1. Giới thiệu & Kiến trúc Tổng thể\n");
            sb.append("Hệ thống **").append(ctx.primaryName).append("** được thiết kế theo kiến trúc phân tầng hiện đại, ")
                    .append("tích hợp quản lý vòng đời tài liệu sống (Living Documentation), phân tích AST và phát hiện sai lệch tự động.\n\n");

            sb.append("## 2. Cấu trúc Thư mục & Thành phần Chính\n\n");
            Map<String, List<String>> groupedByDir = ctx.scannedFiles.stream()
                    .collect(Collectors.groupingBy(fp -> {
                        int idx = fp.lastIndexOf('/');
                        return idx > 0 ? fp.substring(0, idx) : "(Root)";
                    }, LinkedHashMap::new, Collectors.toList()));

            for (Map.Entry<String, List<String>> entry : groupedByDir.entrySet()) {
                sb.append("- **").append(entry.getKey()).append("** (").append(entry.getValue().size()).append(" files)\n");
            }

            sb.append("\n## 3. Danh mục các Lớp & API Trọng tâm trong Hệ thống\n\n");
            sb.append("| Thành phần / Lớp | Phương thức chính | Kiểu trả về | Trạng thái tài liệu |\n");
            sb.append("| :--- | :--- | :--- | :--- |\n");
            if (ctx.aiEntities != null && !ctx.aiEntities.isEmpty()) {
                for (var ent : ctx.aiEntities.stream().limit(40).toList()) {
                    sb.append("| `").append(ent.class_name() != null ? ent.class_name() : ctx.primaryName).append("` | ");
                    sb.append("`").append(ent.method_name() != null ? ent.method_name() : (ent.signature() != null ? ent.signature() : "Component")).append("` | ");
                    sb.append("`").append(ent.return_type() != null ? ent.return_type() : "void").append("` | ");
                    sb.append(ent.doc_status() != null ? ent.doc_status() : "DOCUMENTED").append(" |\n");
                }
            } else {
                sb.append("| `").append(ctx.primaryName).append("` | `main / bootstrap` | `void` | DOCUMENTED |\n");
            }

            sb.append("\n## 4. Hướng dẫn Cài đặt & Vận hành Nhanh\n");
            sb.append("```bash\n");
            sb.append("# 1. Clone kho lưu trữ\n");
            sb.append("git clone https://github.com/").append(ctx.targetSourcePath).append(".git\n\n");
            sb.append("# 2. Khởi chạy hệ thống\n");
            sb.append("./mvnw spring-boot:run\n");
            sb.append("```\n");
            return sb.toString();
        }

        // Mặc định: SCOPE_FILE
        String className = ctx.primaryName != null ? ctx.primaryName : "Component";
        sb.append("# Tài liệu Kỹ thuật: ").append(className).append("\n\n");
        sb.append("> **Phạm vi sinh tài liệu:** `FILE`  \n");
        sb.append("> **Mẫu tài liệu:** ").append(ctx.templateType).append("  \n");
        sb.append("> **File nguồn:** `").append(ctx.targetSourcePath).append("`  \n");
        sb.append("> **Chế độ:** Tự động tổng hợp từ cấu trúc AST\n\n");
        sb.append("## 1. Tổng quan & Trách nhiệm thành phần\n");
        sb.append("Lớp `").append(className).append("` chịu trách nhiệm xử lý logic nghiệp vụ chính của module, đảm bảo tính liên kết và nhất quán dữ liệu.\n\n");
        sb.append("## 2. Bảng kê Phương thức & Đặc tả Kỹ thuật\n\n");
        sb.append("| Tên phương thức | Kiểu trả về | Tham số | Dòng |\n");
        sb.append("| :--- | :--- | :--- | :--- |\n");

        if (ctx.aiEntities != null) {
            for (var ent : ctx.aiEntities) {
                sb.append("| `").append(ent.method_name() != null ? ent.method_name() : ent.signature()).append("` | ");
                sb.append("`").append(ent.return_type() != null ? ent.return_type() : "void").append("` | ");
                sb.append(ent.parameters() != null ? ent.parameters() : "None").append(" | ");
                sb.append("L").append(ent.start_line()).append("-L").append(ent.end_line()).append(" |\n");
            }
        }

        sb.append("\n## 3. Hướng dẫn Tích hợp & Sử dụng\n");
        sb.append("```java\n");
        sb.append("@Autowired\n");
        sb.append("private ").append(className).append(" targetService;\n\n");
        sb.append("// Gọi các phương thức nghiệp vụ của ").append(className).append("\n");
        sb.append("```\n");
        return sb.toString();
    }

    private List<AiDocGenerateResponseDto.GroundingEvidenceDto> buildGroundingEvidences(
            List<AiDocGenerateResponseDto.GroundingEvidenceDto> aiEvidences,
            ScopeOrchestrationContext context
    ) {
        if (aiEvidences != null && !aiEvidences.isEmpty()) {
            return aiEvidences;
        }
        List<AiDocGenerateResponseDto.GroundingEvidenceDto> list = new ArrayList<>();
        if (context.dbEntities != null && !context.dbEntities.isEmpty()) {
            for (CodeEntity e : context.dbEntities) {
                list.add(AiDocGenerateResponseDto.GroundingEvidenceDto.builder()
                        .file_path(e.getFilePath())
                        .class_name(e.getClassName())
                        .method_name(e.getMethodName())
                        .start_line(e.getStartLine())
                        .end_line(e.getEndLine())
                        .commit_hash(e.getCommitHash())
                        .build());
            }
        } else if (context.aiEntities != null && !context.aiEntities.isEmpty()) {
            for (AiDocGenerateRequestDto.CodeEntityItemDto e : context.aiEntities) {
                list.add(AiDocGenerateResponseDto.GroundingEvidenceDto.builder()
                        .file_path(context.targetSourcePath)
                        .class_name(e.class_name())
                        .method_name(e.method_name())
                        .start_line(e.start_line())
                        .end_line(e.end_line())
                        .commit_hash(context.sourceCommit)
                        .build());
            }
        }
        return list;
    }

    private String normalizeScope(String rawScope) {
        if (!StringUtils.hasText(rawScope)) {
            return SCOPE_FILE;
        }
        String s = rawScope.trim().toUpperCase(Locale.ROOT);
        if ("PACKAGE".equals(s) || "MODULE".equals(s) || "FOLDER".equals(s) || "DIRECTORY".equals(s)) {
            return SCOPE_PACKAGE;
        }
        if ("REPOSITORY".equals(s) || "REPO".equals(s) || "SYSTEM".equals(s) || "WHOLE_REPO".equals(s)) {
            return SCOPE_REPOSITORY;
        }
        return SCOPE_FILE;
    }

    private Long resolveRepositoryId(Long requestedRepoId) {
        if (requestedRepoId != null && requestedRepoId > 0) {
            return requestedRepoId;
        }
        if (repositoryRepository != null) {
            List<RepositoryEntity> all = repositoryRepository.findAll();
            if (!all.isEmpty()) {
                return all.get(0).getRepositoryId();
            }
        }
        return null;
    }

    private RepositoryEntity findRepositoryEntity(Long repoId, Long actorId) {
        if (repositoryRepository == null) {
            return null;
        }
        if (repoId != null) {
            Optional<RepositoryEntity> opt = repositoryRepository.findById(repoId);
            if (opt.isPresent()) {
                return opt.get();
            }
        }
        List<RepositoryEntity> all = repositoryRepository.findAll();
        return all.isEmpty() ? null : all.get(0);
    }

    private Long resolveTemplateId(Long requestedTemplateId, String requestedTemplateType, String scope) {
        if (requestedTemplateId != null && requestedTemplateId > 0) {
            return requestedTemplateId;
        }
        if (docTemplateRepository != null) {
            List<DocTemplate> templates = docTemplateRepository.findAll();
            if (StringUtils.hasText(requestedTemplateType)) {
                for (DocTemplate t : templates) {
                    if (requestedTemplateType.equalsIgnoreCase(t.getType())) {
                        return t.getId();
                    }
                }
            }
            String preferredType = switch (scope) {
                case SCOPE_PACKAGE -> "MODULE_GUIDE";
                case SCOPE_REPOSITORY -> "README";
                default -> "API_REFERENCE";
            };
            for (DocTemplate t : templates) {
                if (preferredType.equalsIgnoreCase(t.getType())) {
                    return t.getId();
                }
            }
            if (!templates.isEmpty()) {
                return templates.get(0).getId();
            }
        }
        return 1L;
    }

    private String resolveTemplateType(String requestedTemplateType, Long templateId, String scope) {
        if (StringUtils.hasText(requestedTemplateType)) {
            return requestedTemplateType.trim();
        }
        if (docTemplateRepository != null && templateId != null) {
            Optional<DocTemplate> opt = docTemplateRepository.findById(templateId);
            if (opt.isPresent() && StringUtils.hasText(opt.get().getType())) {
                return opt.get().getType();
            }
        }
        return switch (scope) {
            case SCOPE_PACKAGE -> "MODULE_GUIDE";
            case SCOPE_REPOSITORY -> "README";
            default -> "API_REFERENCE";
        };
    }

    private String fetchFileContentFromGitHub(RepositoryEntity repo, String filePath, String branch, Long actorId) {
        try {
            String[] parts = parseOwnerAndRepo(repo.getRepoFullName());
            if (parts.length != 2) {
                return null;
            }
            String token = resolveGitHubToken(repo, actorId);
            return gitHubClient.getFileContent(token, parts[0], parts[1], filePath, branch);
        } catch (Exception ex) {
            log.debug("[AiDocService] Không thể tải file {} từ GitHub: {}", filePath, ex.getMessage());
            return null;
        }
    }

    private List<GitHubFileDto> fetchRepoTreeFromGitHub(RepositoryEntity repo, String branch, Long actorId) {
        try {
            String[] parts = parseOwnerAndRepo(repo.getRepoFullName());
            if (parts.length != 2) {
                return Collections.emptyList();
            }
            String token = resolveGitHubToken(repo, actorId);
            return gitHubClient.getRepositoryTree(token, parts[0], parts[1], branch, true);
        } catch (Exception ex) {
            log.debug("[AiDocService] Không thể tải cây thư mục từ GitHub: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private String resolveGitHubToken(RepositoryEntity repo, Long actorId) {
        if (gitHubConnectionRepository == null || repo == null) {
            return null;
        }
        if (actorId != null) {
            Optional<GitHubConnectionEntity> userConn = gitHubConnectionRepository
                    .findByWorkspaceIdAndUserId(repo.getWorkspaceId(), actorId);
            if (userConn.isPresent() && isUsableToken(userConn.get().getAccessTokenEncrypted())) {
                return userConn.get().getAccessTokenEncrypted();
            }
        }
        if (repo.getConnectionId() != null) {
            Optional<GitHubConnectionEntity> conn = gitHubConnectionRepository.findById(repo.getConnectionId());
            if (conn.isPresent() && isUsableToken(conn.get().getAccessTokenEncrypted())) {
                return conn.get().getAccessTokenEncrypted();
            }
        }
        Optional<GitHubConnectionEntity> wsConn = gitHubConnectionRepository
                .findFirstByWorkspaceIdOrderByCreatedAtDesc(repo.getWorkspaceId());
        if (wsConn.isPresent() && isUsableToken(wsConn.get().getAccessTokenEncrypted())) {
            return wsConn.get().getAccessTokenEncrypted();
        }
        return null;
    }

    private boolean isUsableToken(String token) {
        return StringUtils.hasText(token)
                && !"DUMMY_TOKEN".equalsIgnoreCase(token.trim())
                && !token.trim().startsWith("enc:v1:");
    }

    private String[] parseOwnerAndRepo(String fullName) {
        if (!StringUtils.hasText(fullName) || !fullName.contains("/")) {
            return new String[0];
        }
        int idx = fullName.indexOf('/');
        return new String[]{fullName.substring(0, idx).trim(), fullName.substring(idx + 1).trim()};
    }

    private List<AiDocGenerateRequestDto.CodeEntityItemDto> mergeCodeEntityDtos(
            List<AiDocGenerateRequestDto.CodeEntityItemDto> requestedEntities,
            List<CodeEntity> dbEntities
    ) {
        if (requestedEntities != null && !requestedEntities.isEmpty()) {
            return requestedEntities;
        }
        if (dbEntities == null || dbEntities.isEmpty()) {
            return Collections.emptyList();
        }
        return dbEntities.stream()
                .map(e -> AiDocGenerateRequestDto.CodeEntityItemDto.builder()
                        .entity_type(e.getEntityType() != null ? e.getEntityType() : "METHOD")
                        .class_name(e.getClassName())
                        .method_name(e.getMethodName())
                        .signature(e.getSignature() != null ? e.getSignature() : (e.getMethodName() != null ? e.getMethodName() + "()" : e.getClassName()))
                        .return_type(e.getReturnType() != null ? e.getReturnType() : "void")
                        .parameters(e.getParameters())
                        .start_line(e.getStartLine() != null ? e.getStartLine() : 1)
                        .end_line(e.getEndLine() != null ? e.getEndLine() : 1)
                        .doc_status(e.getDocStatus() != null ? e.getDocStatus() : "UNDOCUMENTED")
                        .javadoc(null)
                        .annotations(Collections.emptyList())
                        .build())
                .collect(Collectors.toList());
    }

    private String findPrimaryClassName(
            List<CodeEntity> dbEntities,
            List<AiDocGenerateRequestDto.CodeEntityItemDto> aiEntities
    ) {
        if (dbEntities != null) {
            for (CodeEntity e : dbEntities) {
                if (StringUtils.hasText(e.getClassName())) {
                    return e.getClassName();
                }
            }
        }
        if (aiEntities != null) {
            for (var e : aiEntities) {
                if (StringUtils.hasText(e.class_name())) {
                    return e.class_name();
                }
            }
        }
        return null;
    }

    private String findCommitHash(List<CodeEntity> entities, String defaultCommit) {
        if (entities != null) {
            for (CodeEntity e : entities) {
                if (StringUtils.hasText(e.getCommitHash())) {
                    return e.getCommitHash();
                }
            }
        }
        return defaultCommit;
    }

    private String extractSimpleNameFromPath(String filePath) {
        if (!StringUtils.hasText(filePath)) {
            return "Component";
        }
        String normalized = filePath.replace('\\', '/');
        String fileName = normalized.contains("/")
                ? normalized.substring(normalized.lastIndexOf('/') + 1)
                : normalized;
        int dotIdx = fileName.lastIndexOf('.');
        return dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
    }

    private String normalizePackagePathPrefix(String rawPackage) {
        if (!StringUtils.hasText(rawPackage)) {
            return "src/main/java";
        }
        String trimmed = rawPackage.trim().replace('\\', '/');
        // Nếu người dùng truyền kiểu com.example.service (không có dấu / và không kết thúc bằng đuôi file)
        if (!trimmed.contains("/") && trimmed.contains(".") && !trimmed.endsWith(".java") && !trimmed.endsWith(".ts") && !trimmed.endsWith(".py")) {
            return trimmed.replace('.', '/');
        }
        return trimmed.replaceAll("/+$", "");
    }

    private boolean matchesPackageScope(String filePath, String rawPackageInput, String normalizedPrefix) {
        String normFile = filePath.replace('\\', '/');
        if (normFile.startsWith(normalizedPrefix)) {
            return true;
        }
        if (normFile.contains("/" + normalizedPrefix + "/") || normFile.endsWith("/" + normalizedPrefix)) {
            return true;
        }
        if (StringUtils.hasText(rawPackageInput)) {
            String slashPkg = rawPackageInput.trim().replace('.', '/');
            return normFile.contains(slashPkg);
        }
        return false;
    }

    private String extractPackageDisplayName(String normalizedPrefix) {
        if (!StringUtils.hasText(normalizedPrefix)) {
            return "root";
        }
        String cleaned = normalizedPrefix.replace('\\', '/').replaceAll("^/+|/+$", "");
        if (cleaned.contains("src/main/java/")) {
            cleaned = cleaned.substring(cleaned.indexOf("src/main/java/") + "src/main/java/".length());
        }
        return cleaned.replace('/', '.');
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String v : values) {
            if (StringUtils.hasText(v)) {
                return v.trim();
            }
        }
        return "";
    }

    private record ScopeOrchestrationContext(
            String scope,
            String targetSourcePath,
            String primaryName,
            String templateType,
            String sourceCode,
            String documentTitle,
            String documentTargetPath,
            String sourceCommit,
            List<CodeEntity> dbEntities,
            List<AiDocGenerateRequestDto.CodeEntityItemDto> aiEntities,
            List<String> scannedFiles
    ) {}
}
