
package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AstExtractRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import com.example.livingdocs_backend.application.dto.ai.DocGapSummaryDto;
import com.example.livingdocs_backend.application.dto.ai.DocumentationGapDto;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/**
 * Service xử lý bóc tách AST từ AI Engine, lưu Code Entities và tính tỷ lệ bao
 * phủ tài liệu (% Coverage).
 */
@Slf4j
@Service
public class CodeIndexService implements CodeIndexServicePort {

    private final CodeEntityRepositoryPort codeEntityRepository;
    private final RestClient restClient;

    @Autowired(required = false)
    private SpringDataDocCodeLinkRepository docCodeLinkRepository;

    @Autowired(required = false)
    private SpringDataRepositoryRepository repositoryRepository;

    @Autowired
    public CodeIndexService(
            CodeEntityRepositoryPort codeEntityRepository,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl,
            @Autowired(required = false) SpringDataDocCodeLinkRepository docCodeLinkRepository,
            @Autowired(required = false) SpringDataRepositoryRepository repositoryRepository) {
        this.codeEntityRepository = codeEntityRepository;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.repositoryRepository = repositoryRepository;
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(15000);
        this.restClient = RestClient.builder()
                .baseUrl(aiEngineUrl)
                .requestFactory(factory)
                .build();
    }

    public CodeIndexService(CodeEntityRepositoryPort codeEntityRepository, String aiEngineUrl) {
        this(codeEntityRepository, aiEngineUrl, null, null);
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

    private boolean isEntityDocumented(CodeEntity e, Set<Long> documentedEntityIds, Set<String> documentedKeys) {
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
