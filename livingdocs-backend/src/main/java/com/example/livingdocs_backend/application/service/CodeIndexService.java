package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AstExtractRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocGapSummaryDto;
import com.example.livingdocs_backend.application.dto.ai.DocRewriteRequestDto;
import com.example.livingdocs_backend.application.dto.ai.DocRewriteResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocumentationGapDto;
import com.example.livingdocs_backend.application.dto.code.EntityDocRegenerateRequestDto;
import com.example.livingdocs_backend.application.dto.code.EntityDocRegenerateResponseDto;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.util.HashUtils;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service xử lý bóc tách AST từ AI Engine, lưu Code Entities, tính tỷ lệ bao
 * phủ tài liệu (% Coverage) và tạo lại tài liệu cục bộ cho từng thực thể mã nguồn.
 */
@Slf4j
@Service
public class CodeIndexService implements CodeIndexServicePort {

    private static final Pattern HEADING_PATTERN = Pattern.compile("^(#{2,6})\\s+(.+)$");

    private final CodeEntityRepositoryPort codeEntityRepository;
    private final RestClient restClient;

    @Autowired(required = false)
    private SpringDataDocCodeLinkRepository docCodeLinkRepository;

    @Autowired(required = false)
    private SpringDataRepositoryRepository repositoryRepository;

    @Autowired(required = false)
    private DocumentRepositoryPort documentRepositoryPort;

    @Autowired(required = false)
    private DocumentVersionRepositoryPort documentVersionRepositoryPort;

    @Autowired
    public CodeIndexService(
            CodeEntityRepositoryPort codeEntityRepository,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl,
            @Autowired(required = false) SpringDataDocCodeLinkRepository docCodeLinkRepository,
            @Autowired(required = false) SpringDataRepositoryRepository repositoryRepository,
            @Autowired(required = false) DocumentRepositoryPort documentRepositoryPort,
            @Autowired(required = false) DocumentVersionRepositoryPort documentVersionRepositoryPort) {
        this.codeEntityRepository = codeEntityRepository;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.repositoryRepository = repositoryRepository;
        this.documentRepositoryPort = documentRepositoryPort;
        this.documentVersionRepositoryPort = documentVersionRepositoryPort;
        String resolvedUrl = (aiEngineUrl != null ? aiEngineUrl : "http://127.0.0.1:8000")
                .replace("localhost", "127.0.0.1");
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(8000);
        this.restClient = RestClient.builder()
                .baseUrl(resolvedUrl)
                .requestFactory(factory)
                .build();
    }

    public CodeIndexService(
            CodeEntityRepositoryPort codeEntityRepository,
            String aiEngineUrl,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataRepositoryRepository repositoryRepository) {
        this(codeEntityRepository, aiEngineUrl, docCodeLinkRepository, repositoryRepository, null, null);
    }

    public CodeIndexService(CodeEntityRepositoryPort codeEntityRepository, String aiEngineUrl) {
        this(codeEntityRepository, aiEngineUrl, null, null, null, null);
    }

    public CodeIndexService(
            CodeEntityRepositoryPort codeEntityRepository,
            DocumentRepositoryPort documentRepositoryPort,
            DocumentVersionRepositoryPort documentVersionRepositoryPort) {
        this(codeEntityRepository, "http://localhost:8000", null, null, documentRepositoryPort, documentVersionRepositoryPort);
    }

    public CodeIndexService(
            CodeEntityRepositoryPort codeEntityRepository,
            DocumentRepositoryPort documentRepositoryPort,
            DocumentVersionRepositoryPort documentVersionRepositoryPort,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            String aiEngineUrl) {
        this(codeEntityRepository, aiEngineUrl, docCodeLinkRepository, null, documentRepositoryPort, documentVersionRepositoryPort);
    }

    public CodeIndexService(CodeEntityRepositoryPort codeEntityRepository, RestClient restClient) {
        this.codeEntityRepository = codeEntityRepository;
        this.restClient = restClient;
    }

    @Override
    @Transactional
    public List<CodeEntity> indexFile(Long repositoryId, String filePath, String sourceCode, String commitHash) {
        log.info("Bắt đầu bóc tách và lập chỉ mục AST cho repo={}, file={}", repositoryId, filePath);

        if (!StringUtils.hasText(filePath) || !StringUtils.hasText(sourceCode)) {
            log.warn("Bỏ qua bóc tách AST vì filePath hoặc sourceCode rỗng (repo={}, file={})", repositoryId, filePath);
            return Collections.emptyList();
        }

        // 1. Gọi FastAPI /v1/ast/extract
        AstExtractResponseDto response;
        try {
            response = extractAstRaw(repositoryId, filePath, sourceCode, commitHash);
        } catch (Exception ex) {
            log.warn("Không thể bóc tách AST từ AI Engine cho file={}, trả về danh sách hiện có: {}", filePath, ex.getMessage());
            List<CodeEntity> existing = getEntitiesByFile(repositoryId, filePath);
            return existing != null ? existing : Collections.emptyList();
        }

        if (response == null || response.entities() == null || response.entities().isEmpty()) {
            log.warn("Không tìm thấy entity nào từ kết quả AST cho file={}", filePath);
            return Collections.emptyList();
        }

        // 2. Xóa các entity cũ của file này trong repo để cập nhật mới nhất
        // (idempotent)
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
    public AstExtractResponseDto extractAstRaw(Long repositoryId, String filePath, String sourceCode,
            String commitHash) {
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

    @Override
    public DocCoverageResponseDto calculateRepositoryCoverage(Long repositoryId) {
        List<CodeEntity> entities = getEntitiesByRepository(repositoryId);
        return buildCoverageResponse(repositoryId, null, entities);
    }

    @Override
    public DocCoverageResponseDto calculateFileCoverage(Long repositoryId, String filePath) {
        List<CodeEntity> entities = getEntitiesByFile(repositoryId, filePath);
        return buildCoverageResponse(repositoryId, filePath, entities);
    }

    private DocCoverageResponseDto buildCoverageResponse(Long repositoryId, String filePath,
            List<CodeEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return DocCoverageResponseDto.builder()
                    .repositoryId(repositoryId)
                    .filePath(filePath)
                    .totalEntities(0)
                    .documentedEntities(0)
                    .undocumentedEntities(0)
                    .coveragePercentage(0.0)
                    .byEntityType(Collections.emptyMap())
                    .documentedByEntityType(Collections.emptyMap())
                    .build();
        }

        int total = entities.size();
        int documented = 0;
        Map<String, Integer> byType = new HashMap<>();
        Map<String, Integer> documentedByType = new HashMap<>();

        for (CodeEntity e : entities) {
            String type = e.getEntityType() != null ? e.getEntityType().toUpperCase() : "UNKNOWN";
            byType.put(type, byType.getOrDefault(type, 0) + 1);

            boolean isDoc = "DOCUMENTED".equalsIgnoreCase(e.getDocStatus());
            if (isDoc) {
                documented++;
                documentedByType.put(type, documentedByType.getOrDefault(type, 0) + 1);
            }
        }

        int undocumented = total - documented;
        double pct = BigDecimal.valueOf((double) documented * 100 / total)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        return DocCoverageResponseDto.builder()
                .repositoryId(repositoryId)
                .filePath(filePath)
                .totalEntities(total)
                .documentedEntities(documented)
                .undocumentedEntities(undocumented)
                .coveragePercentage(pct)
                .byEntityType(byType)
                .documentedByEntityType(documentedByType)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public DocGapSummaryDto getDocumentationGaps(
            Long repositoryId,
            String packagePath,
            String entityType,
            String search) {

        List<CodeEntity> allEntities;
        String repoFullName = "All Repositories";

        if (repositoryId != null) {
            allEntities = codeEntityRepository.findByRepositoryId(repositoryId);
            if (repositoryRepository != null) {
                var repoOpt = repositoryRepository.findById(repositoryId);
                if (repoOpt.isPresent()) {
                    repoFullName = repoOpt.get().getRepoFullName();
                }
            }
        } else {
            allEntities = codeEntityRepository.findAll();
        }

        // 1. Thu thập liên kết từ bảng doc_code_links để đối chiếu
        Set<String> documentedKeys = new HashSet<>();
        Set<Long> documentedEntityIds = new HashSet<>();
        if (docCodeLinkRepository != null) {
            try {
                var allLinks = docCodeLinkRepository.findAll();
                for (var link : allLinks) {
                    if (link.getEntityId() != null) {
                        documentedEntityIds.add(link.getEntityId());
                    }
                    String fp = link.getFilePath() != null ? link.getFilePath().trim() : "";
                    String cn = link.getClassName() != null ? link.getClassName().trim() : "";
                    String mn = link.getMethodName() != null ? link.getMethodName().trim() : "";
                    documentedKeys.add(fp + "#" + cn + "#" + mn);
                    if (!mn.isEmpty()) {
                        documentedKeys.add(fp + "#" + cn + "#");
                    }
                }
            } catch (Exception ex) {
                log.warn("Không thể tải danh sách doc_code_links: {}", ex.getMessage());
            }
        }

        int totalEntities = allEntities.size();
        int documentedCount = 0;
        int classGaps = 0;
        int interfaceGaps = 0;
        int methodGaps = 0;

        Set<String> packageSet = new TreeSet<>();
        List<DocumentationGapDto> filteredGaps = new ArrayList<>();

        for (CodeEntity e : allEntities) {
            boolean isDoc = isEntityDocumented(e, documentedEntityIds, documentedKeys);
            if (isDoc) {
                documentedCount++;
                continue;
            }

            // Thực thể này chưa có tài liệu tương ứng -> Gaps
            String rawType = e.getEntityType() != null ? e.getEntityType().toUpperCase() : "UNKNOWN";
            if ("CLASS".equals(rawType)) {
                classGaps++;
            } else if ("INTERFACE".equals(rawType)) {
                interfaceGaps++;
            } else if ("METHOD".equals(rawType) || "CONSTRUCTOR".equals(rawType)) {
                methodGaps++;
            }

            String pkg = extractPackage(e.getFilePath());
            packageSet.add(pkg);

            // Kiểm tra bộ lọc
            // a) Bộ lọc loại phần tử (CLASS, INTERFACE, METHOD)
            if (StringUtils.hasText(entityType) && !"ALL".equalsIgnoreCase(entityType.trim())) {
                String targetType = entityType.trim().toUpperCase();
                if (!targetType.equalsIgnoreCase(rawType)) {
                    continue;
                }
            }

            // b) Bộ lọc gói thư mục / package
            if (StringUtils.hasText(packagePath) && !"ALL".equalsIgnoreCase(packagePath.trim())) {
                String targetPkg = packagePath.trim().toLowerCase();
                String entityPkg = pkg.toLowerCase();
                String filePathLower = e.getFilePath() != null ? e.getFilePath().toLowerCase() : "";
                if (!entityPkg.contains(targetPkg) && !filePathLower.contains(targetPkg)) {
                    continue;
                }
            }

            // c) Bộ lọc tìm kiếm từ khóa
            if (StringUtils.hasText(search)) {
                String s = search.trim().toLowerCase();
                boolean matches = (e.getClassName() != null && e.getClassName().toLowerCase().contains(s))
                        || (e.getMethodName() != null && e.getMethodName().toLowerCase().contains(s))
                        || (e.getFilePath() != null && e.getFilePath().toLowerCase().contains(s))
                        || (e.getSignature() != null && e.getSignature().toLowerCase().contains(s));
                if (!matches) {
                    continue;
                }
            }

            // Gợi ý tiêu đề và loại template
            String suggestedTitle;
            String suggestedTemplate = "API_REFERENCE";
            if ("METHOD".equals(rawType) && StringUtils.hasText(e.getMethodName())) {
                suggestedTitle = "Tài liệu phương thức " + (e.getClassName() != null ? e.getClassName() + "." : "")
                        + e.getMethodName();
            } else if ("INTERFACE".equals(rawType)) {
                suggestedTitle = "Tài liệu đặc tả giao diện "
                        + (e.getClassName() != null ? e.getClassName() : "Interface");
            } else {
                suggestedTitle = "Tài liệu kỹ thuật cho lớp " + (e.getClassName() != null ? e.getClassName() : "Class");
            }

            // URL một chạm điền sẵn thông tin tệp, lớp, phương thức để chuyển hướng sang
            // trang tạo tài liệu AI
            String oneClickUrl = String.format(
                    "/yeu-cau-sinh-tai-lieu?repo=%s&scope=%s&className=%s&methodName=%s&entityType=%s&templateId=1",
                    e.getRepositoryId() != null ? e.getRepositoryId() : (repositoryId != null ? repositoryId : 1L),
                    URLEncoder.encode(e.getFilePath() != null ? e.getFilePath() : "", StandardCharsets.UTF_8),
                    URLEncoder.encode(e.getClassName() != null ? e.getClassName() : "", StandardCharsets.UTF_8),
                    URLEncoder.encode(e.getMethodName() != null ? e.getMethodName() : "", StandardCharsets.UTF_8),
                    URLEncoder.encode(rawType, StandardCharsets.UTF_8));

            filteredGaps.add(DocumentationGapDto.builder()
                    .entityId(e.getEntityId())
                    .repositoryId(e.getRepositoryId())
                    .repoFullName(repoFullName)
                    .filePath(e.getFilePath())
                    .packagePath(pkg)
                    .entityType(rawType)
                    .className(e.getClassName())
                    .methodName(e.getMethodName())
                    .signature(e.getSignature())
                    .returnType(e.getReturnType())
                    .parameters(e.getParameters())
                    .startLine(e.getStartLine())
                    .endLine(e.getEndLine())
                    .commitHash(e.getCommitHash())
                    .docStatus("UNDOCUMENTED")
                    .suggestedDocTitle(suggestedTitle)
                    .suggestedTemplateType(suggestedTemplate)
                    .aiGenerateUrl(oneClickUrl)
                    .createdAt(e.getCreatedAt())
                    .build());
        }

        int totalGaps = totalEntities - documentedCount;
        double coveragePct = totalEntities > 0
                ? BigDecimal.valueOf((double) documentedCount * 100 / totalEntities)
                        .setScale(2, RoundingMode.HALF_UP).doubleValue()
                : 100.0;

        return DocGapSummaryDto.builder()
                .repositoryId(repositoryId)
                .repoFullName(repoFullName)
                .totalEntities(totalEntities)
                .totalGaps(totalGaps)
                .documentedEntities(documentedCount)
                .coveragePercentage(coveragePct)
                .totalClasses(classGaps)
                .totalInterfaces(interfaceGaps)
                .totalMethods(methodGaps)
                .packages(new ArrayList<>(packageSet))
                .items(filteredGaps)
                .build();
    }

    /**
     * Tạo lại tài liệu cục bộ cho một thực thể mã nguồn cụ thể từ Cây mã nguồn (/cay-ma-nguon).
     * Chỉ thay thế đúng mục (section) của thực thể được chọn trong tài liệu tổng thể,
     * giữ nguyên 100% các mục đã phê duyệt khác và lưu thành một phiên bản nháp (DRAFT DocumentVersion) mới.
     */
    @Transactional
    public EntityDocRegenerateResponseDto regenerateEntityDoc(EntityDocRegenerateRequestDto request) {
        Long entityId = request != null ? request.getEntityId() : null;
        return regenerateEntityDoc(entityId, request);
    }

    @Transactional
    public EntityDocRegenerateResponseDto regenerateEntityDoc(Long entityId, EntityDocRegenerateRequestDto request) {
        Long resolvedEntityId = entityId != null ? entityId : (request != null ? request.getEntityId() : null);

        // 1. Tìm CodeEntity hiện có trong CSDL
        CodeEntity existingEntity = findCodeEntity(resolvedEntityId, request);

        Long repoId = firstNonNull(
                request != null ? request.getRepositoryId() : null,
                existingEntity != null ? existingEntity.getRepositoryId() : null,
                1L);
        String filePath = firstNonBlank(
                request != null ? request.getFilePath() : null,
                existingEntity != null ? existingEntity.getFilePath() : null,
                "src/main/java/com/example/MainService.java");
        String commitHash = firstNonBlank(
                request != null ? request.getCommitHash() : null,
                existingEntity != null ? existingEntity.getCommitHash() : null,
                "head");

        // 2. Bóc tách lại cú pháp AST mới nhất nếu có sourceCode thực tế (nhiều dòng) truyền lên
        AstExtractResponseDto.CodeEntityItemDto extractedAstItem = null;
        String sourceCode = request != null ? request.getSourceCode() : null;
        if (StringUtils.hasText(sourceCode) && sourceCode.contains("\n")) {
            try {
                AstExtractResponseDto astResp = extractAstRaw(repoId, filePath, sourceCode, commitHash);
                if (astResp != null && astResp.entities() != null && !astResp.entities().isEmpty()) {
                    extractedAstItem = matchAstItem(astResp.entities(), existingEntity, request);
                }
            } catch (Exception ex) {
                log.debug("[RegenerateEntityDoc] Bỏ qua gọi /v1/ast/extract từ xa, dùng phân tích AST cục bộ: {}",
                        ex.getMessage());
            }
        }

        String entityType = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.entity_type() : null,
                request != null ? request.getEntityType() : null,
                existingEntity != null ? existingEntity.getEntityType() : null,
                "METHOD").toUpperCase(Locale.ROOT);

        String className = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.class_name() : null,
                request != null ? request.getClassName() : null,
                existingEntity != null ? existingEntity.getClassName() : null,
                extractSimpleClassName(filePath));

        String methodName = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.method_name() : null,
                request != null ? request.getMethodName() : null,
                existingEntity != null ? existingEntity.getMethodName() : null,
                null);

        String signature = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.signature() : null,
                request != null ? request.getSignature() : null,
                existingEntity != null ? existingEntity.getSignature() : null,
                methodName != null ? "public void " + methodName + "()" : "public class " + className);

        String returnType = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.return_type() : null,
                request != null ? request.getReturnType() : null,
                existingEntity != null ? existingEntity.getReturnType() : null,
                "CLASS".equals(entityType) || "INTERFACE".equals(entityType) ? null : "void");

        String parameters = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.parameters() : null,
                request != null ? request.getParameters() : null,
                existingEntity != null ? existingEntity.getParameters() : null,
                extractParametersFromSignature(signature));

        Integer startLine = firstNonNull(
                extractedAstItem != null ? extractedAstItem.start_line() : null,
                request != null ? request.getStartLine() : null,
                existingEntity != null ? existingEntity.getStartLine() : null,
                1);

        Integer endLine = firstNonNull(
                extractedAstItem != null ? extractedAstItem.end_line() : null,
                request != null ? request.getEndLine() : null,
                existingEntity != null ? existingEntity.getEndLine() : null,
                startLine);

        String javadoc = firstNonBlank(
                extractedAstItem != null ? extractedAstItem.javadoc() : null,
                request != null ? request.getJavadoc() : null,
                null);

        // Cập nhật trạng thái thực thể mã sang DOCUMENTED
        Instant now = Instant.now();
        CodeEntity updatedEntity = CodeEntity.builder()
                .entityId(existingEntity != null ? existingEntity.getEntityId() : resolvedEntityId)
                .repositoryId(repoId)
                .filePath(filePath)
                .entityType(entityType)
                .className(className)
                .methodName(methodName)
                .signature(signature)
                .returnType(returnType)
                .parameters(parameters)
                .startLine(startLine)
                .endLine(endLine)
                .commitHash(commitHash)
                .docStatus("DOCUMENTED")
                .createdAt(existingEntity != null && existingEntity.getCreatedAt() != null ? existingEntity.getCreatedAt() : now)
                .updatedAt(now)
                .build();

        if (codeEntityRepository != null) {
            CodeEntity savedEntity = codeEntityRepository.save(updatedEntity);
            if (savedEntity != null) {
                updatedEntity = savedEntity;
            }
        }

        // 3. Trích xuất đoạn mã nguồn của riêng thực thể (nếu sourceCode là toàn bộ file)
        String entitySourceSnippet = extractEntitySnippet(sourceCode, startLine, endLine, signature);

        // 4. Tìm tài liệu tổng thể (Document) tương ứng với file / thực thể
        Long requestedDocId = request != null ? request.getDocumentId() : null;
        Document targetDoc = findTargetDocument(requestedDocId, repoId, filePath, className, methodName, updatedEntity.getEntityId());

        DocumentVersion latestVersion = null;
        String currentFullMarkdown = "";
        if (targetDoc != null && documentVersionRepositoryPort != null && targetDoc.getDocId() != null) {
            latestVersion = documentVersionRepositoryPort.findLatestByDocId(targetDoc.getDocId()).orElse(null);
            if (latestVersion == null) {
                List<DocumentVersion> allVers = documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumDesc(targetDoc.getDocId());
                if (allVers != null && !allVers.isEmpty()) {
                    latestVersion = allVers.get(0);
                }
            }
            if (latestVersion != null && latestVersion.getContent() != null) {
                currentFullMarkdown = latestVersion.getContent();
            }
        }

        // 5. Sinh nội dung Markdown cho riêng thực thể được chọn (qua AI Engine hoặc bộ sinh cục bộ)
        String targetEntityName = StringUtils.hasText(methodName) ? methodName : className;
        String matchedHeadingPrefix = detectExistingHeadingPrefix(currentFullMarkdown, targetEntityName);
        String instruction = request != null ? request.getInstruction() : null;

        SectionGenerationOutcome genOutcome = generateLocalizedEntitySection(
                updatedEntity,
                javadoc,
                entitySourceSnippet,
                instruction,
                matchedHeadingPrefix,
                currentFullMarkdown);

        String updatedSectionMarkdown = genOutcome.sectionMarkdown();

        // 6. Thay thế CHỈ mục (section) của thực thể này trong tài liệu tổng thể, giữ nguyên các mục khác
        String updatedFullMarkdown;
        int nextVersionNum;
        String prevHash;
        String newHash;
        DocumentVersion savedVersion = null;

        if (targetDoc == null) {
            // Chưa có tài liệu cho file này -> Khởi tạo tài liệu mới v1 ở trạng thái DRAFT
            updatedFullMarkdown = buildInitialDocumentWithSection(updatedEntity, updatedSectionMarkdown);
            nextVersionNum = 1;
            prevHash = HashUtils.GENESIS_HASH;
            newHash = HashUtils.calculateVersionHash(
                    prevHash,
                    nextVersionNum,
                    updatedFullMarkdown,
                    ActorRole.AI.name(),
                    "REGENERATE_ENTITY_DOC");

            Document newDoc = Document.builder()
                    .repoId(repoId)
                    .title("Tài liệu Kỹ thuật - " + className)
                    .targetPath(filePath.endsWith(".md") ? filePath : "docs/files/" + filePath + ".md")
                    .status(DocumentStatus.DRAFT)
                    .currentVersion(1)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            if (documentRepositoryPort != null) {
                Document persistedDoc = documentRepositoryPort.save(newDoc);
                targetDoc = persistedDoc != null ? persistedDoc : newDoc;
            } else {
                targetDoc = newDoc;
            }

            DocumentVersion v1 = DocumentVersion.builder()
                    .docId(targetDoc.getDocId())
                    .versionNum(1)
                    .content(updatedFullMarkdown)
                    .actorRole(ActorRole.AI)
                    .triggerType("REGENERATE_ENTITY_DOC")
                    .prevHash(prevHash)
                    .hash(newHash)
                    .createdAt(now)
                    .build();

            if (documentVersionRepositoryPort != null) {
                savedVersion = documentVersionRepositoryPort.save(v1);
            }
            if (savedVersion == null) {
                savedVersion = v1;
            }
        } else {
            // Đã có tài liệu -> Chỉ cập nhật đúng section của thực thể, giữ nguyên các section khác
            updatedFullMarkdown = replaceOrAppendEntitySection(
                    currentFullMarkdown,
                    targetEntityName,
                    updatedSectionMarkdown);

            int currentVer = targetDoc.getCurrentVersion() != null
                    ? targetDoc.getCurrentVersion()
                    : (latestVersion != null && latestVersion.getVersionNum() != null ? latestVersion.getVersionNum() : 1);
            nextVersionNum = currentVer + 1;

            prevHash = (latestVersion != null && StringUtils.hasText(latestVersion.getHash()))
                    ? latestVersion.getHash()
                    : HashUtils.GENESIS_HASH;
            newHash = HashUtils.calculateVersionHash(
                    prevHash,
                    nextVersionNum,
                    updatedFullMarkdown,
                    ActorRole.AI.name(),
                    "REGENERATE_ENTITY_DOC");

            DocumentVersion nextVersion = DocumentVersion.builder()
                    .docId(targetDoc.getDocId())
                    .versionNum(nextVersionNum)
                    .content(updatedFullMarkdown)
                    .actorRole(ActorRole.AI)
                    .triggerType("REGENERATE_ENTITY_DOC")
                    .prevHash(prevHash)
                    .hash(newHash)
                    .createdAt(now)
                    .build();

            if (documentVersionRepositoryPort != null) {
                savedVersion = documentVersionRepositoryPort.save(nextVersion);
            }
            if (savedVersion == null) {
                savedVersion = nextVersion;
            }

            targetDoc.setStatus(DocumentStatus.DRAFT);
            targetDoc.setCurrentVersion(nextVersionNum);
            targetDoc.setUpdatedAt(now);
            if (documentRepositoryPort != null) {
                Document persistedDoc = documentRepositoryPort.save(targetDoc);
                if (persistedDoc != null) {
                    targetDoc = persistedDoc;
                }
            }
        }

        // 7. Đảm bảo liên kết trong bảng doc_code_links
        ensureDocCodeLink(targetDoc.getDocId(), updatedEntity);

        String summary = String.format(
                "Đã tạo lại tài liệu cục bộ cho %s `%s` và lưu vào Phiên bản nháp v%d (DRAFT) mà không làm thay đổi các mục đã duyệt khác.",
                "CLASS".equalsIgnoreCase(entityType) ? "lớp" : "phương thức",
                targetEntityName,
                nextVersionNum);

        return EntityDocRegenerateResponseDto.builder()
                .versionId(savedVersion.getVersionId())
                .documentId(targetDoc.getDocId())
                .documentTitle(targetDoc.getTitle())
                .targetPath(targetDoc.getTargetPath())
                .versionNumber(nextVersionNum)
                .contentHash(newHash)
                .previousHash(prevHash)
                .entityId(updatedEntity.getEntityId())
                .repositoryId(repoId)
                .filePath(filePath)
                .entityType(entityType)
                .className(className)
                .methodName(methodName)
                .signature(signature)
                .returnType(returnType)
                .parameters(parameters)
                .startLine(startLine)
                .endLine(endLine)
                .docStatus("DOCUMENTED")
                .status(DocumentStatus.DRAFT.name())
                .updatedSectionMarkdown(updatedSectionMarkdown)
                .fullMarkdown(updatedFullMarkdown)
                .summaryOfChanges(summary)
                .mode(genOutcome.mode())
                .build();
    }

    /**
     * Thay thế chính xác CHỈ section tương ứng với `targetEntityName` trong tài liệu Markdown tổng thể,
     * bảo toàn 100% các mục (sections) trước và sau nó. Nếu chưa có mục của `targetEntityName`, nối thêm vào cuối.
     */
    public String replaceOrAppendEntitySection(
            String existingMarkdown,
            String targetEntityName,
            String newSectionMarkdown) {
        if (!StringUtils.hasText(existingMarkdown)) {
            return newSectionMarkdown != null ? newSectionMarkdown.trim() : "";
        }
        if (!StringUtils.hasText(targetEntityName)) {
            return existingMarkdown.trim() + "\n\n" + (newSectionMarkdown != null ? newSectionMarkdown.trim() : "");
        }

        String[] lines = existingMarkdown.split("\\r?\\n", -1);
        int sectionStart = -1;
        int sectionLevel = -1;
        boolean inCodeBlock = false;

        for (int i = 0; i < lines.length; i++) {
            String trimmed = lines[i].trim();
            if (trimmed.startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) {
                continue;
            }
            Matcher m = HEADING_PATTERN.matcher(lines[i]);
            if (m.matches()) {
                int level = m.group(1).length();
                String headingTitle = m.group(2).trim();
                if (headingMatchesEntity(headingTitle, targetEntityName)) {
                    sectionStart = i;
                    sectionLevel = level;
                    break;
                }
            }
        }

        String normalizedNewSection = newSectionMarkdown != null ? newSectionMarkdown.trim() : "";

        // Nếu chưa tồn tại section của thực thể này trong tài liệu -> nối vào cuối tài liệu
        if (sectionStart < 0) {
            return existingMarkdown.stripTrailing() + "\n\n" + normalizedNewSection + "\n";
        }

        // Tìm dòng kết thúc của section hiện tại (heading tiếp theo có cấp độ <= sectionLevel)
        int sectionEnd = lines.length;
        inCodeBlock = false;
        for (int i = sectionStart + 1; i < lines.length; i++) {
            String trimmed = lines[i].trim();
            if (trimmed.startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) {
                continue;
            }
            if (lines[i].startsWith("#")) {
                int hashes = 0;
                while (hashes < lines[i].length() && lines[i].charAt(hashes) == '#') {
                    hashes++;
                }
                if (hashes >= 1 && hashes <= sectionLevel && hashes < lines[i].length()
                        && Character.isWhitespace(lines[i].charAt(hashes))) {
                    sectionEnd = i;
                    break;
                }
            }
        }

        StringBuilder result = new StringBuilder();
        if (sectionStart > 0) {
            for (int i = 0; i < sectionStart; i++) {
                result.append(lines[i]).append("\n");
            }
        }

        result.append(normalizedNewSection).append("\n");

        if (sectionEnd < lines.length) {
            result.append("\n");
            for (int i = sectionEnd; i < lines.length; i++) {
                result.append(lines[i]);
                if (i < lines.length - 1) {
                    result.append("\n");
                }
            }
        }

        return result.toString();
    }

    private boolean headingMatchesEntity(String headingTitle, String targetEntityName) {
        if (!StringUtils.hasText(headingTitle) || !StringUtils.hasText(targetEntityName)) {
            return false;
        }
        String cleaned = headingTitle.replace("`", "").replace("*", "").trim();
        Pattern tokenPattern = Pattern.compile(
                "(?i)(^|[^a-zA-Z0-9_])" + Pattern.quote(targetEntityName.trim()) + "($|[^a-zA-Z0-9_])");
        return tokenPattern.matcher(cleaned).find();
    }

    private String detectExistingHeadingPrefix(String markdown, String targetEntityName) {
        if (!StringUtils.hasText(markdown) || !StringUtils.hasText(targetEntityName)) {
            return "###";
        }
        String[] lines = markdown.split("\\r?\\n", -1);
        boolean inCodeBlock = false;
        for (String line : lines) {
            if (line.trim().startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) {
                continue;
            }
            Matcher m = HEADING_PATTERN.matcher(line);
            if (m.matches() && headingMatchesEntity(m.group(2), targetEntityName)) {
                return m.group(1);
            }
        }
        return "###";
    }

    private record SectionGenerationOutcome(String sectionMarkdown, String mode) {
    }

    private SectionGenerationOutcome generateLocalizedEntitySection(
            CodeEntity entity,
            String javadoc,
            String sourceSnippet,
            String customInstruction,
            String headingHashes,
            String currentFullMarkdown) {

        String targetName = StringUtils.hasText(entity.getMethodName())
                ? entity.getMethodName()
                : entity.getClassName();
        String hashes = StringUtils.hasText(headingHashes) ? headingHashes : "###";

        // Thử gọi AI Engine (/v1/docs/rewrite-suggestion) nếu có kết nối
        if (restClient != null) {
            try {
                String promptInstruction = StringUtils.hasText(customInstruction)
                        ? customInstruction
                        : "Viết lại chính xác mục tài liệu kỹ thuật cho thực thể `" + targetName
                                + "` với chữ ký mới `" + entity.getSignature() + "`.";
                DocRewriteRequestDto req = DocRewriteRequestDto.builder()
                        .current_doc(StringUtils.hasText(currentFullMarkdown) ? currentFullMarkdown : "")
                        .code_diff(sourceSnippet)
                        .file_path(entity.getFilePath())
                        .entity_name(targetName)
                        .commit_hash(entity.getCommitHash())
                        .instruction(promptInstruction)
                        .build();

                DocRewriteResponseDto aiResp = restClient.post()
                        .uri("/v1/docs/rewrite-suggestion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(req)
                        .retrieve()
                        .body(DocRewriteResponseDto.class);

                if (aiResp != null && !"mock".equalsIgnoreCase(aiResp.getMode())
                        && aiResp.getSection_diffs() != null && !aiResp.getSection_diffs().isEmpty()) {
                    String aiSection = aiResp.getSection_diffs().get(0).getNew_content();
                    if (StringUtils.hasText(aiSection) && aiSection.contains(targetName)) {
                        String trimmed = aiSection.trim();
                        if (!trimmed.startsWith("#")) {
                            trimmed = hashes + " " + targetName + "\n\n" + trimmed;
                        }
                        return new SectionGenerationOutcome(trimmed, "ai");
                    }
                }
            } catch (Exception ex) {
                log.debug("[RegenerateEntityDoc] AI Engine không phản hồi, sử dụng bộ sinh AST cục bộ cho {}: {}",
                        targetName, ex.getMessage());
            }
        }

        // Bộ sinh tài liệu cục bộ thông minh dựa trên cú pháp AST mới nhất
        StringBuilder sb = new StringBuilder();
        sb.append(hashes).append(" ").append(targetName).append("\n\n");
        sb.append("- **Phân loại:** `").append(entity.getEntityType() != null ? entity.getEntityType() : "METHOD").append("`");
        if (StringUtils.hasText(entity.getClassName())) {
            sb.append(" (Lớp: `").append(entity.getClassName()).append("`)");
        }
        sb.append("\n");
        sb.append("- **Chữ ký (Signature):** `").append(entity.getSignature()).append("`\n");
        sb.append("- **Tham số (Parameters):** ")
                .append(StringUtils.hasText(entity.getParameters()) ? "`" + entity.getParameters() + "`" : "Không có tham số")
                .append("\n");
        if (StringUtils.hasText(entity.getReturnType())) {
            sb.append("- **Kiểu trả về (Return Type):** `").append(entity.getReturnType()).append("`\n");
        }
        sb.append("- **Vị trí mã nguồn:** `").append(entity.getFilePath()).append("` (Dòng ")
                .append(entity.getStartLine() != null ? entity.getStartLine() : 1)
                .append(" – ")
                .append(entity.getEndLine() != null ? entity.getEndLine() : 1)
                .append(")\n");

        String desc;
        if (StringUtils.hasText(javadoc)) {
            desc = cleanJavadocText(javadoc);
        } else if ("CLASS".equalsIgnoreCase(entity.getEntityType()) || "INTERFACE".equalsIgnoreCase(entity.getEntityType())) {
            desc = "Thực thể `" + targetName + "` đóng vai trò xử lý nghiệp vụ và điều phối thành phần trong tệp `"
                    + entity.getFilePath() + "`.";
        } else {
            desc = "Phương thức `" + targetName + "` thực thi xử lý nghiệp vụ với chữ ký `"
                    + entity.getSignature() + "`"
                    + (StringUtils.hasText(entity.getReturnType()) ? " và trả về kết quả kiểu `" + entity.getReturnType() + "`." : ".");
        }
        sb.append("- **Mô tả kỹ thuật:** ").append(desc).append("\n");

        if (StringUtils.hasText(customInstruction)) {
            sb.append("- **Ghi chú cập nhật:** ").append(customInstruction.trim()).append("\n");
        }

        if (StringUtils.hasText(sourceSnippet)) {
            String fenceLang = resolveCodeFenceLanguage(entity.getFilePath());
            sb.append("\n```").append(fenceLang).append("\n").append(sourceSnippet.trim()).append("\n```");
        }

        return new SectionGenerationOutcome(sb.toString(), "ast-localized");
    }

    private String resolveCodeFenceLanguage(String filePath) {
        if (!StringUtils.hasText(filePath)) {
            return "java";
        }
        String lower = filePath.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".tsx")) {
            return "tsx";
        }
        if (lower.endsWith(".ts")) {
            return "ts";
        }
        if (lower.endsWith(".jsx") || lower.endsWith(".js")) {
            return "javascript";
        }
        if (lower.endsWith(".py")) {
            return "python";
        }
        if (lower.endsWith(".sql")) {
            return "sql";
        }
        return "java";
    }

    private String buildInitialDocumentWithSection(CodeEntity entity, String entitySectionMarkdown) {
        String className = StringUtils.hasText(entity.getClassName())
                ? entity.getClassName()
                : extractSimpleClassName(entity.getFilePath());
        StringBuilder sb = new StringBuilder();
        sb.append("# Tài liệu Kỹ thuật: ").append(className).append("\n\n");
        sb.append("> **Tệp nguồn:** `").append(entity.getFilePath()).append("`  \n");
        sb.append("> **Trạng thái:** Bản nháp tự động cập nhật theo thực thể mã nguồn (`DRAFT`)\n\n");
        sb.append("## 1. Tổng quan Thành phần\n\n");
        sb.append("Tài liệu kỹ thuật cho thành phần `").append(className).append("` tại đường dẫn `")
                .append(entity.getFilePath()).append("`.\n\n");
        sb.append("## 2. Chi tiết Thực thể Mã nguồn\n\n");
        sb.append(entitySectionMarkdown.trim()).append("\n");
        return sb.toString();
    }

    private CodeEntity findCodeEntity(Long entityId, EntityDocRegenerateRequestDto request) {
        if (codeEntityRepository == null) {
            return null;
        }
        List<CodeEntity> candidates = new ArrayList<>();
        if (request != null && request.getRepositoryId() != null && StringUtils.hasText(request.getFilePath())) {
            List<CodeEntity> byFile = codeEntityRepository.findByRepositoryIdAndFilePath(
                    request.getRepositoryId(), request.getFilePath());
            if (byFile != null) {
                candidates.addAll(byFile);
            }
        }
        if (candidates.isEmpty() && request != null && request.getRepositoryId() != null) {
            List<CodeEntity> byRepo = codeEntityRepository.findByRepositoryId(request.getRepositoryId());
            if (byRepo != null) {
                candidates.addAll(byRepo);
            }
        }
        if (candidates.isEmpty()) {
            List<CodeEntity> all = codeEntityRepository.findAll();
            if (all != null) {
                candidates.addAll(all);
            }
        }

        if (entityId != null) {
            for (CodeEntity ce : candidates) {
                if (entityId.equals(ce.getEntityId())) {
                    return ce;
                }
            }
        }

        if (request != null) {
            for (CodeEntity ce : candidates) {
                if (StringUtils.hasText(request.getMethodName())
                        && request.getMethodName().equals(ce.getMethodName())
                        && (!StringUtils.hasText(request.getClassName()) || request.getClassName().equals(ce.getClassName()))) {
                    return ce;
                }
            }
            for (CodeEntity ce : candidates) {
                if (StringUtils.hasText(request.getSignature()) && request.getSignature().equals(ce.getSignature())) {
                    return ce;
                }
            }
            for (CodeEntity ce : candidates) {
                if (!StringUtils.hasText(request.getMethodName())
                        && StringUtils.hasText(request.getClassName())
                        && request.getClassName().equals(ce.getClassName())
                        && "CLASS".equalsIgnoreCase(ce.getEntityType())) {
                    return ce;
                }
            }
        }
        return null;
    }

    private Document findTargetDocument(
            Long requestedDocId,
            Long repoId,
            String filePath,
            String className,
            String methodName,
            Long entityId) {
        if (documentRepositoryPort == null) {
            return null;
        }
        if (requestedDocId != null) {
            Optional<Document> byId = documentRepositoryPort.findById(requestedDocId);
            if (byId.isPresent()) {
                return byId.get();
            }
        }

        String simpleFile = extractSimpleClassName(filePath);
        boolean isGenericFileName = simpleFile != null && Set.of(
                "page", "index", "layout", "route", "loading", "error", "main", "app", "component"
        ).contains(simpleFile.toLowerCase(Locale.ROOT));

        if (docCodeLinkRepository != null && StringUtils.hasText(filePath)) {
            try {
                List<DocCodeLinkEntity> links = docCodeLinkRepository.findByFilePath(filePath);
                if (links != null) {
                    for (DocCodeLinkEntity link : links) {
                        if (link.getDocumentId() != null) {
                            Optional<Document> linkedDoc = documentRepositoryPort.findById(link.getDocumentId());
                            if (linkedDoc.isPresent() && isDocumentMatchingTarget(linkedDoc.get(), filePath, className, simpleFile, isGenericFileName)) {
                                return linkedDoc.get();
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.debug("Không thể truy vấn doc_code_links theo filePath {}: {}", filePath, ex.getMessage());
            }
        }

        List<Document> candidates = new ArrayList<>();
        if (repoId != null) {
            List<Document> repoDocs = documentRepositoryPort.findByRepoId(repoId);
            if (repoDocs != null) {
                candidates.addAll(repoDocs);
            }
        }
        if (candidates.isEmpty()) {
            List<Document> allDocs = documentRepositoryPort.findAll();
            if (allDocs != null) {
                candidates.addAll(allDocs);
            }
        }

        // Ưu tiên khớp theo targetPath hoặc className trong title
        for (Document doc : candidates) {
            if (StringUtils.hasText(doc.getTargetPath()) && StringUtils.hasText(filePath)) {
                if (doc.getTargetPath().contains(filePath) || filePath.contains(doc.getTargetPath())) {
                    return doc;
                }
            }
        }
        for (Document doc : candidates) {
            if (isDocumentMatchingTarget(doc, filePath, className, simpleFile, isGenericFileName)) {
                return doc;
            }
        }

        return null;
    }

    private boolean isDocumentMatchingTarget(
            Document doc,
            String filePath,
            String className,
            String simpleFile,
            boolean isGenericFileName) {
        if (doc == null) {
            return false;
        }
        if (StringUtils.hasText(doc.getTargetPath()) && StringUtils.hasText(filePath)) {
            if (doc.getTargetPath().contains(filePath) || filePath.contains(doc.getTargetPath())) {
                return true;
            }
        }
        if (StringUtils.hasText(className) && StringUtils.hasText(doc.getTitle())
                && doc.getTitle().toLowerCase(Locale.ROOT).contains(className.toLowerCase(Locale.ROOT))) {
            return true;
        }
        if (!isGenericFileName && StringUtils.hasText(simpleFile) && StringUtils.hasText(doc.getTargetPath())
                && doc.getTargetPath().toLowerCase(Locale.ROOT).contains(simpleFile.toLowerCase(Locale.ROOT))) {
            return true;
        }
        return false;
    }

    private boolean hasHeadingForEntity(String markdown, String targetEntityName) {
        if (!StringUtils.hasText(markdown) || !StringUtils.hasText(targetEntityName)) {
            return false;
        }
        String[] lines = markdown.split("\\r?\\n", -1);
        boolean inCodeBlock = false;
        for (String line : lines) {
            if (line.trim().startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) {
                continue;
            }
            Matcher m = HEADING_PATTERN.matcher(line);
            if (m.matches() && headingMatchesEntity(m.group(2), targetEntityName)) {
                return true;
            }
        }
        return false;
    }

    private void ensureDocCodeLink(Long documentId, CodeEntity entity) {
        if (docCodeLinkRepository == null || documentId == null || entity == null || !StringUtils.hasText(entity.getFilePath())) {
            return;
        }
        try {
            List<DocCodeLinkEntity> existingLinks = docCodeLinkRepository.findByDocumentId(documentId);
            if (existingLinks != null) {
                for (DocCodeLinkEntity link : existingLinks) {
                    boolean sameFile = entity.getFilePath().equals(link.getFilePath());
                    boolean sameMethod = Objects.equals(entity.getMethodName(), link.getMethodName());
                    boolean sameClass = Objects.equals(entity.getClassName(), link.getClassName());
                    if (sameFile && sameMethod && sameClass) {
                        return;
                    }
                }
            }
            docCodeLinkRepository.save(DocCodeLinkEntity.builder()
                    .documentId(documentId)
                    .entityId(entity.getEntityId())
                    .filePath(entity.getFilePath())
                    .className(entity.getClassName())
                    .methodName(entity.getMethodName())
                    .createdAt(Instant.now())
                    .build());
        } catch (Exception ex) {
            log.debug("Không thể lưu liên kết doc_code_links: {}", ex.getMessage());
        }
    }

    private AstExtractResponseDto.CodeEntityItemDto matchAstItem(
            List<AstExtractResponseDto.CodeEntityItemDto> items,
            CodeEntity existingEntity,
            EntityDocRegenerateRequestDto request) {
        String targetMethod = firstNonBlank(
                request != null ? request.getMethodName() : null,
                existingEntity != null ? existingEntity.getMethodName() : null,
                null);
        String targetClass = firstNonBlank(
                request != null ? request.getClassName() : null,
                existingEntity != null ? existingEntity.getClassName() : null,
                null);

        if (StringUtils.hasText(targetMethod)) {
            for (var item : items) {
                if (targetMethod.equals(item.method_name())) {
                    return item;
                }
            }
        }
        if (StringUtils.hasText(targetClass)) {
            for (var item : items) {
                if (targetClass.equals(item.class_name()) && !StringUtils.hasText(item.method_name())) {
                    return item;
                }
            }
        }
        return items.get(0);
    }

    private String extractEntitySnippet(String sourceCode, Integer startLine, Integer endLine, String fallbackSignature) {
        if (!StringUtils.hasText(sourceCode)) {
            return fallbackSignature;
        }
        String[] lines = sourceCode.split("\\r?\\n");
        if (startLine != null && endLine != null && startLine >= 1 && endLine >= startLine && lines.length >= endLine && lines.length > 1) {
            StringBuilder sb = new StringBuilder();
            for (int i = startLine - 1; i < Math.min(lines.length, endLine); i++) {
                sb.append(lines[i]);
                if (i < Math.min(lines.length, endLine) - 1) {
                    sb.append("\n");
                }
            }
            String sliced = sb.toString().trim();
            if (StringUtils.hasText(sliced)) {
                return sliced;
            }
        }
        return sourceCode.trim();
    }

    private String extractParametersFromSignature(String signature) {
        if (!StringUtils.hasText(signature)) {
            return null;
        }
        int open = signature.indexOf('(');
        int close = signature.lastIndexOf(')');
        if (open >= 0 && close > open) {
            String inside = signature.substring(open + 1, close).trim();
            return inside.isEmpty() ? null : inside;
        }
        return null;
    }

    private String extractSimpleClassName(String filePath) {
        if (!StringUtils.hasText(filePath)) {
            return "Component";
        }
        String normalized = filePath.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        String fileName = slash >= 0 ? normalized.substring(slash + 1) : normalized;
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    private String cleanJavadocText(String javadoc) {
        if (!StringUtils.hasText(javadoc)) {
            return "";
        }
        return Arrays.stream(javadoc.split("\\r?\\n"))
                .map(line -> line.replaceFirst("^\\s*/?\\*+/\\s*$", "")
                        .replaceFirst("^\\s*/\\*+\\s*", "")
                        .replaceFirst("^\\s*\\*\\s?", "")
                        .trim())
                .filter(line -> !line.isEmpty())
                .reduce((a, b) -> a + " " + b)
                .orElse(javadoc.trim());
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String v : values) {
            if (StringUtils.hasText(v)) {
                return v.trim();
            }
        }
        return null;
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        if (values == null) {
            return null;
        }
        for (T v : values) {
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    private boolean isEntityDocumented(CodeEntity e, Set<Long> documentedEntityIds, Set<String> documentedKeys) {
        if ("UNDOCUMENTED".equalsIgnoreCase(e.getDocStatus())) {
            return false;
        }
        if ("DOCUMENTED".equalsIgnoreCase(e.getDocStatus())) {
            return true;
        }
        if (e.getEntityId() != null && documentedEntityIds.contains(e.getEntityId())) {
            return true;
        }
        String fp = e.getFilePath() != null ? e.getFilePath().trim() : "";
        String cn = e.getClassName() != null ? e.getClassName().trim() : "";
        String mn = e.getMethodName() != null ? e.getMethodName().trim() : "";
        if (documentedKeys.contains(fp + "#" + cn + "#" + mn)) {
            return true;
        }
        if (mn.isEmpty() && documentedKeys.contains(fp + "#" + cn + "#")) {
            return true;
        }
        return false;
    }

    public static String extractPackage(String filePath) {
        if (!StringUtils.hasText(filePath)) {
            return "default";
        }
        String normalized = filePath.replace('\\', '/');
        int lastSlash = normalized.lastIndexOf('/');
        if (lastSlash <= 0) {
            return "root";
        }
        String dir = normalized.substring(0, lastSlash);
        int srcMainJava = dir.indexOf("src/main/java/");
        if (srcMainJava >= 0) {
            dir = dir.substring(srcMainJava + "src/main/java/".length());
        } else {
            int srcTestJava = dir.indexOf("src/test/java/");
            if (srcTestJava >= 0) {
                dir = dir.substring(srcTestJava + "src/test/java/".length());
            } else {
                int src = dir.indexOf("src/");
                if (src >= 0) {
                    dir = dir.substring(src + "src/".length());
                }
            }
        }
        return dir.replace('/', '.');
    }
}
