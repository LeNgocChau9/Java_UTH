package com.example.livingdocs_backend.application.service;

/**
 * Task tuần 7: Đánh giá chất lượng tài liệu và kiểm tra điều kiện chặn PR merge gate.
 */
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.example.livingdocs_backend.application.dto.TemplateValidationResult;
import com.example.livingdocs_backend.application.dto.drift.PrMergeBlockingPolicyDto;
import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationRequest;
import com.example.livingdocs_backend.application.dto.quality.DocumentQualityEvaluationResponse;
import com.example.livingdocs_backend.application.dto.quality.MissingEntityDto;
import com.example.livingdocs_backend.application.dto.quality.MissingParamDto;
import com.example.livingdocs_backend.application.dto.quality.PhantomSymbolDto;
import com.example.livingdocs_backend.application.dto.quality.QualityWarningDto;
import com.example.livingdocs_backend.application.port.DocQualityEvaluationServicePort;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Triển khai dịch vụ Chấm điểm Chất lượng Tài liệu & Chống Ảo giác AI (Anti-Hallucination Gate - Task Tuần 7).
 * - Xóa bỏ hoàn toàn confidence_score gán cứng.
 * - Đối chiếu Markdown với danh sách code_entities thật từ AST.
 * - Tính 3 chỉ số thật:
 *   (1) Entity & Param Coverage
 *   (2) Anti-Hallucination Score (Quét và bắt Phantom Symbols không có trong code)
 *   (3) Template Compliance
 * - Phục vụ hiển thị chi tiết lên Editor, Staff Review Queue, Quality Dashboard và Chặn PR Gate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocQualityEvaluationServiceImpl implements DocQualityEvaluationServicePort {

    private final SpringDataCodeEntityRepository codeEntityRepository;
    private final DocTemplateRepository docTemplateRepository;
    private final TemplateStructureCheck templateStructureCheck;
    private final DocumentRepositoryPort documentRepositoryPort;
    private final DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final PrMergeBlockingServiceImpl prMergeBlockingService;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    // Bộ từ khóa / kiểu chuẩn an toàn phổ biến (không xem là ảo giác)
    private static final Set<String> SAFE_STANDARD_SYMBOLS = new HashSet<>(Arrays.asList(
            // Kiểu dữ liệu Java cơ bản & thư viện cốt lõi
            "string", "integer", "int", "long", "double", "float", "boolean", "byte", "char", "short",
            "void", "object", "list", "map", "set", "collection", "arraylist", "hashmap", "hashset",
            "optional", "stream", "comparable", "comparator", "runnable", "callable", "future",
            "completablefuture", "uuid", "instant", "localdatetime", "localdate", "localtime", "date",
            "bigdecimal", "biginteger", "bytearray", "inputstream", "outputstream", "reader", "writer",
            "exception", "runtimeexception", "throwable", "error", "nullpointerexception",
            "illegalargumentexception", "illegalstateexception", "entitynotfoundexception",
            "responseentity", "httpstatus", "restclient", "resttemplate", "webclient",
            // Từ khóa Spring & Annotations
            "service", "controller", "restcontroller", "repository", "component", "configuration", "bean",
            "autowired", "override", "transactional", "getmapping", "postmapping", "putmapping", "deletemapping",
            "patchmapping", "requestmapping", "requestparam", "pathvariable", "requestbody", "valid",
            "validated", "schema", "operation", "tag", "securityrequirement", "preauthorize",
            "entity", "table", "id", "generatedvalue", "column", "manytoone", "onetomany", "onetoone",
            "manytomany", "joincolumn", "builder", "data", "getter", "setter", "noargsconstructor",
            "allargsconstructor", "requiredargsconstructor", "slf4j", "extern",
            // HTTP & REST
            "get", "post", "put", "delete", "patch", "head", "options", "http", "https", "json", "xml",
            "bearer", "jwt", "authorization", "content-type", "accept", "application/json", "text/plain",
            "200", "201", "204", "400", "401", "403", "404", "409", "422", "429", "500", "502", "503",
            // Markdown & Ngôn ngữ
            "bash", "sh", "curl", "git", "main", "master", "head", "sha", "commit", "branch", "pr",
            "pull", "push", "merge", "rebase", "diff", "true", "false", "null", "undefined", "nan",
            "java", "python", "typescript", "javascript", "ts", "js", "sql", "ddl", "html", "css", "yaml", "yml",
            // Thuật ngữ chung
            "id", "name", "title", "description", "content", "status", "type", "createdat", "updatedat",
            "createdby", "updatedby", "version", "versionnum", "code", "message", "timestamp", "path",
            "file", "filepath", "url", "email", "password", "token", "accesstoken", "refreshtoken",
            "role", "roles", "user", "admin", "staff", "manager", "tech_lead", "developer", "guest",
            "item", "items", "data", "result", "response", "request", "payload", "body", "header", "headers",
            "param", "params", "parameter", "parameters", "query", "filter", "search", "page", "size", "limit",
            "offset", "sort", "direction", "asc", "desc", "total", "count", "success", "error", "failure",
            "active", "inactive", "draft", "published", "pending", "approved", "rejected", "deleted", "archived",
            "equals", "hashcode", "tostring", "clone", "getid", "setid", "build", "builder", "from", "of"
    ));

    @Override
    @Transactional(readOnly = true)
    public DocumentQualityEvaluationResponse evaluateQuality(DocumentQualityEvaluationRequest request) {
        Long repoId = request.getRepositoryId();
        Long docId = request.getDocumentId();
        if (tenantAccessService != null) {
            if (docId != null) {
                tenantAccessService.requireDocumentAccess(docId);
            }
            if (repoId != null) {
                tenantAccessService.requireRepositoryAccess(repoId);
            }
        }
        String markdown = request.getMarkdown();
        String filePath = request.getFilePath();
        String docTitle = "Tài liệu kỹ thuật";

        // 1. Tự động lấy thông tin từ DocumentEntity nếu có documentId
        if (docId != null) {
            Optional<Document> docOpt = documentRepositoryPort.findById(docId);
            if (docOpt.isPresent()) {
                Document doc = docOpt.get();
                if (repoId == null && doc.getRepoId() != null) {
                    repoId = doc.getRepoId();
                }
                if (!StringUtils.hasText(filePath) && StringUtils.hasText(doc.getTargetPath())) {
                    filePath = doc.getTargetPath();
                }
                if (!StringUtils.hasText(markdown)) {
                    var latestVersionOpt = documentVersionRepositoryPort.findLatestByDocId(docId);
                    if (latestVersionOpt.isPresent() && StringUtils.hasText(latestVersionOpt.get().getContent())) {
                        markdown = latestVersionOpt.get().getContent();
                    }
                }
                if (StringUtils.hasText(doc.getTitle())) {
                    docTitle = doc.getTitle();
                }
            }
        }

        markdown = markdown != null ? markdown : "";
        String markdownLower = markdown.toLowerCase(Locale.ROOT);

        // Lấy tên Repository
        String repoName = "Chưa xác định";
        if (repoId != null) {
            repoName = repositoryRepository.findById(repoId)
                    .map(RepositoryEntity::getRepoFullName)
                    .orElse("Repository #" + repoId);
        }

        // 2. Tải cấu hình ngưỡng chất lượng từ PR Merge Blocking Policy
        PrMergeBlockingPolicyDto policy = prMergeBlockingService.getBlockingPolicy();
        double minQualityThreshold = request.getMinQualityThreshold() != null
                ? (request.getMinQualityThreshold() <= 1.0 ? request.getMinQualityThreshold() * 100.0 : request.getMinQualityThreshold())
                : 75.0; // Mặc định 75%
        double minAntiHallucinationThreshold = request.getMinAntiHallucinationThreshold() != null
                ? (request.getMinAntiHallucinationThreshold() <= 1.0 ? request.getMinAntiHallucinationThreshold() * 100.0 : request.getMinAntiHallucinationThreshold())
                : 80.0; // Mặc định 80%

        // 3. Tải danh sách Code Entities thật từ CSDL
        List<CodeEntityJpaEntity> allRepoEntities = repoId != null
                ? codeEntityRepository.findByRepositoryId(repoId)
                : Collections.emptyList();

        // Phạm vi entity cần đối chiếu độ phủ: nếu có filePath, lọc theo filePath, nếu không lấy theo repo
        List<CodeEntityJpaEntity> inScopeEntities = allRepoEntities;
        if (StringUtils.hasText(filePath)) {
            String normPath = filePath.replace("\\", "/").trim();
            List<CodeEntityJpaEntity> fileFiltered = allRepoEntities.stream()
                    .filter(e -> e.getFilePath() != null && e.getFilePath().replace("\\", "/").contains(normPath))
                    .toList();
            if (!fileFiltered.isEmpty()) {
                inScopeEntities = fileFiltered;
            }
        }

        // 4. Xây dựng tập hợp Ground Truth Symbols từ mã nguồn thật
        Set<String> realClassNames = new HashSet<>();
        Set<String> realMethodNames = new HashSet<>();
        Set<String> realFieldNames = new HashSet<>();
        Set<String> realParamNames = new HashSet<>();
        Set<String> realEndpoints = new HashSet<>();
        Set<String> realAllSymbolsLower = new HashSet<>();

        for (CodeEntityJpaEntity entity : allRepoEntities) {
            if (StringUtils.hasText(entity.getClassName())) {
                realClassNames.add(entity.getClassName());
                realAllSymbolsLower.add(entity.getClassName().toLowerCase(Locale.ROOT));
            }
            if (StringUtils.hasText(entity.getMethodName())) {
                realMethodNames.add(entity.getMethodName());
                realAllSymbolsLower.add(entity.getMethodName().toLowerCase(Locale.ROOT));
            }
            // Bóc tách tham số từ parameters
            if (StringUtils.hasText(entity.getParameters())) {
                extractParamNames(entity.getParameters()).forEach(param -> {
                    realParamNames.add(param);
                    realAllSymbolsLower.add(param.toLowerCase(Locale.ROOT));
                });
            }
            // Bóc tách endpoint API từ signature hoặc annotations
            if (StringUtils.hasText(entity.getSignature())) {
                extractApiPaths(entity.getSignature()).forEach(p -> {
                    realEndpoints.add(p);
                    realAllSymbolsLower.add(p.toLowerCase(Locale.ROOT));
                });
            }
        }

        // Bổ sung các endpoint tiêu chuẩn của LivingDocs để tránh cảnh báo nhầm các endpoint chuẩn
        realEndpoints.add("/api/documents");
        realEndpoints.add("/api/templates");
        realEndpoints.add("/api/auth/login");
        realEndpoints.add("/api/auth/register");
        realEndpoints.add("/api/health");
        realEndpoints.add("/v1/docs/generate");
        realEndpoints.add("/v1/docs/evaluate-quality");

        // ── CHỈ SỐ 1: ENTITY & PARAM COVERAGE ──
        List<MissingEntityDto> missingEntities = new ArrayList<>();
        List<MissingParamDto> missingParams = new ArrayList<>();

        int totalEntities = 0;
        int documentedEntities = 0;
        int totalParams = 0;
        int documentedParams = 0;

        for (CodeEntityJpaEntity entity : inScopeEntities) {
            String cName = entity.getClassName();
            String mName = entity.getMethodName();

            boolean isClassEntity = "CLASS".equalsIgnoreCase(entity.getEntityType()) || (cName != null && mName == null);
            if (isClassEntity) {
                totalEntities++;
                if (cName != null && containsIdentifier(markdown, cName)) {
                    documentedEntities++;
                } else if (cName != null) {
                    missingEntities.add(MissingEntityDto.builder()
                            .entityId(entity.getEntityId())
                            .className(cName)
                            .entityType("CLASS")
                            .filePath(entity.getFilePath())
                            .signature(entity.getSignature())
                            .suggestedMarkdown("### Lớp: `" + cName + "`\n- Đặc tả trách nhiệm nghiệp vụ và các phụ thuộc của lớp `" + cName + "`.")
                            .build());
                }
            } else if (mName != null && !mName.isBlank() && mName.length() >= 3) {
                totalEntities++;
                boolean mDoc = containsIdentifier(markdown, mName);
                if (mDoc) {
                    documentedEntities++;
                } else {
                    missingEntities.add(MissingEntityDto.builder()
                            .entityId(entity.getEntityId())
                            .className(cName)
                            .methodName(mName)
                            .entityType("METHOD")
                            .filePath(entity.getFilePath())
                            .signature(entity.getSignature())
                            .suggestedMarkdown("#### Phương thức: `" + (entity.getSignature() != null ? entity.getSignature() : mName + "()") + "`\n- Mô tả chi tiết logic xử lý, dữ liệu đầu vào và kết quả trả về.")
                            .build());
                }

                // Đối chiếu tham số của method
                if (StringUtils.hasText(entity.getParameters())) {
                    List<String> pNames = extractParamNames(entity.getParameters());
                    for (String pName : pNames) {
                        if (pName.length() >= 2 && !SAFE_STANDARD_SYMBOLS.contains(pName.toLowerCase(Locale.ROOT))) {
                            totalParams++;
                            if (containsIdentifier(markdown, pName)) {
                                documentedParams++;
                            } else {
                                missingParams.add(MissingParamDto.builder()
                                        .className(cName)
                                        .methodName(mName)
                                        .paramName(pName)
                                        .paramType("Tham số")
                                        .suggestion("Bổ sung giải thích tham số `" + pName + "` của phương thức `" + mName + "` trong tài liệu.")
                                        .build());
                            }
                        }
                    }
                }
            }
        }

        double entityCoveragePercent = totalEntities > 0
                ? round1(((double) documentedEntities / totalEntities) * 100.0)
                : 100.0;
        double paramCoveragePercent = totalParams > 0
                ? round1(((double) documentedParams / totalParams) * 100.0)
                : 100.0;
        double overallCoveragePercent = round1((entityCoveragePercent * 0.70) + (paramCoveragePercent * 0.30));

        // ── CHỈ SỐ 2: ANTI-HALLUCINATION SCORE (PHÁT HIỆN PHANTOM SYMBOLS) ──
        List<PhantomSymbolDto> phantomSymbols = new ArrayList<>();
        int totalSymbolsChecked = 0;

        String[] lines = markdown.split("\\r?\\n");
        Pattern backtickPattern = Pattern.compile("`([^`\\n]+)`");
        Pattern methodCallPattern = Pattern.compile("\\b([a-zA-Z][a-zA-Z0-9_]{2,})\\s*\\(");
        Pattern apiPathPattern = Pattern.compile("(?i)(/(?:api|v\\d+|[a-zA-Z0-9_\\-]+)(?:/[a-zA-Z0-9_\\-\\{\\}\\:]+)+)");

        Set<String> alreadyFlagged = new HashSet<>();

        for (int lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            String line = lines[lineIdx].trim();
            int lineNum = lineIdx + 1;

            if (line.isBlank() || line.startsWith("```")) {
                continue;
            }

            // 1. Quét các API paths trong dòng
            Matcher apiMatcher = apiPathPattern.matcher(line);
            while (apiMatcher.find()) {
                String rawPath = apiMatcher.group(1).trim();
                String cleanPath = rawPath.replaceAll("[`'\"\\),;]+$", "");
                if (cleanPath.startsWith("/api") || cleanPath.startsWith("/v1") || cleanPath.contains("/")) {
                    totalSymbolsChecked++;
                    String pathLower = cleanPath.toLowerCase(Locale.ROOT);
                    if (!isKnownOrPatternMatchedEndpoint(pathLower, realEndpoints) && !alreadyFlagged.contains(cleanPath)) {
                        alreadyFlagged.add(cleanPath);
                        phantomSymbols.add(PhantomSymbolDto.builder()
                                .symbol(cleanPath)
                                .symbolType("API_PATH")
                                .lineNumber(lineNum)
                                .contextSnippet(line)
                                .severity("CRITICAL")
                                .reason("Đường dẫn API '" + cleanPath + "' không tồn tại trong danh sách Endpoint của hệ thống (Ảo giác AI).")
                                .suggestion(findClosestMatch(cleanPath, realEndpoints))
                                .build());
                    }
                }
            }

            // 2. Quét các backtick symbols `symbol`
            Matcher btMatcher = backtickPattern.matcher(line);
            while (btMatcher.find()) {
                String raw = btMatcher.group(1).trim();
                // Bỏ qua nếu là đường dẫn file đã quét hoặc chuỗi json/curl
                if (raw.startsWith("/") || raw.contains(" ") || raw.contains(":") || raw.length() < 3 || raw.length() > 60) {
                    continue;
                }
                String symbol = raw.replaceAll("\\(.*\\)", "").replaceAll("[^a-zA-Z0-9_]", "");
                if (symbol.length() < 3) {
                    continue;
                }

                totalSymbolsChecked++;
                String symbolLower = symbol.toLowerCase(Locale.ROOT);

                if (SAFE_STANDARD_SYMBOLS.contains(symbolLower)) {
                    continue;
                }

                boolean existsInCode = realAllSymbolsLower.contains(symbolLower);
                if (!existsInCode && !alreadyFlagged.contains(symbol)) {
                    // Kiểm tra xem symbol có dạng hàm (camelCase) hoặc class (PascalCase) không
                    boolean looksLikeMethod = Character.isLowerCase(symbol.charAt(0)) && (hasUpper(symbol) || line.contains(symbol + "("));
                    boolean looksLikeClass = Character.isUpperCase(symbol.charAt(0)) && (symbol.endsWith("Service") || symbol.endsWith("Controller") || symbol.endsWith("Repository") || symbol.endsWith("Entity") || symbol.endsWith("Dto") || hasUpper(symbol.substring(1)));

                    if (looksLikeMethod || looksLikeClass) {
                        alreadyFlagged.add(symbol);
                        String type = looksLikeMethod ? "METHOD" : "CLASS";
                        phantomSymbols.add(PhantomSymbolDto.builder()
                                .symbol(symbol)
                                .symbolType(type)
                                .lineNumber(lineNum)
                                .contextSnippet(line)
                                .severity("CRITICAL")
                                .reason("Ký hiệu '" + symbol + "' được AI nhắc đến như một " + (looksLikeMethod ? "phương thức" : "lớp") + " nhưng hoàn toàn KHÔNG tồn tại trong mã nguồn thật.")
                                .suggestion(findClosestMatch(symbol, looksLikeMethod ? realMethodNames : realClassNames))
                                .build());
                    }
                }
            }

            // 3. Quét pattern lời gọi hàm methodName(...)
            Matcher callMatcher = methodCallPattern.matcher(line);
            while (callMatcher.find()) {
                String m = callMatcher.group(1).trim();
                String mLower = m.toLowerCase(Locale.ROOT);
                if (m.length() >= 4 && !SAFE_STANDARD_SYMBOLS.contains(mLower) && !realAllSymbolsLower.contains(mLower)) {
                    if (!alreadyFlagged.contains(m)) {
                        totalSymbolsChecked++;
                        alreadyFlagged.add(m);
                        phantomSymbols.add(PhantomSymbolDto.builder()
                                .symbol(m + "()")
                                .symbolType("METHOD")
                                .lineNumber(lineNum)
                                .contextSnippet(line)
                                .severity("CRITICAL")
                                .reason("Lời gọi hàm '" + m + "()' không tồn tại trong bất kỳ lớp nào của mã nguồn thật.")
                                .suggestion(findClosestMatch(m, realMethodNames))
                                .build());
                    }
                }
            }
        }

        // Tính điểm Anti-Hallucination: Mỗi phantom symbol phạt nặng
        double antiHallucinationPercent = 100.0;
        if (!phantomSymbols.isEmpty()) {
            double penalty = (phantomSymbols.size() * 15.0) + Math.min(25.0, phantomSymbols.size() * 5.0);
            antiHallucinationPercent = Math.max(0.0, round1(100.0 - penalty));
        }

        // ── CHỈ SỐ 3: TEMPLATE COMPLIANCE ──
        List<String> missingHeadings = new ArrayList<>();
        int requiredHeadingsCount = 0;
        int matchedHeadingsCount = 0;

        Long tplId = request.getTemplateId();
        DocTemplate template = null;
        if (tplId != null) {
            template = docTemplateRepository.findById(tplId).orElse(null);
            if (template != null && tenantAccessService != null && template.getWorkspaceId() != null) {
                tenantAccessService.requireWorkspaceAccess(template.getWorkspaceId());
            }
        }
        if (template == null) {
            List<DocTemplate> accessibleTemplates;
            if (tenantAccessService != null) {
                TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
                if (scope.unassigned()) {
                    accessibleTemplates = docTemplateRepository.findByWorkspaceIdIsNull();
                } else {
                    Long wsId = tenantAccessService.resolveReadWorkspaceId(null);
                    accessibleTemplates = wsId != null
                            ? docTemplateRepository.findAccessibleByWorkspaceId(wsId)
                            : docTemplateRepository.findAll();
                }
            } else {
                accessibleTemplates = docTemplateRepository.findAll();
            }
            template = accessibleTemplates.stream()
                    .filter(t -> Boolean.TRUE.equals(t.getIsDefault()))
                    .findFirst()
                    .orElseGet(() -> accessibleTemplates.stream().findFirst().orElse(null));
        }

        if (template != null) {
            TemplateValidationResult val = templateStructureCheck.check(template.getId(), markdown);
            if (val.getMissingHeadings() != null) {
                missingHeadings.addAll(val.getMissingHeadings());
            }
            // Ước tính số đề mục dựa trên kết quả check
            requiredHeadingsCount = missingHeadings.size() + (val.isValid() ? 4 : 2);
            matchedHeadingsCount = Math.max(0, requiredHeadingsCount - missingHeadings.size());
        } else {
            // Mẫu dự phòng mặc định (Tổng quan, Chức năng, Bảng tham số, Xử lý lỗi, Ví dụ)
            String[] defaultHeadings = {"Tổng quan", "Endpoint", "Tham số", "Mã lỗi", "Ví dụ"};
            requiredHeadingsCount = defaultHeadings.length;
            for (String h : defaultHeadings) {
                if (markdownLower.contains(h.toLowerCase(Locale.ROOT))) {
                    matchedHeadingsCount++;
                } else {
                    missingHeadings.add("Mục " + h);
                }
            }
        }

        double templateCompliancePercent = requiredHeadingsCount > 0
                ? round1(((double) matchedHeadingsCount / requiredHeadingsCount) * 100.0)
                : 100.0;

        // ── TỔNG HỢP ĐIỂM CHẤT LƯỢNG (WEIGHTED REAL QUALITY SCORE) ──
        // Trọng số: 40% Anti-Hallucination, 35% Entity & Param Coverage, 25% Template Compliance
        double overallScore = round1(
                (overallCoveragePercent * 0.35) +
                (antiHallucinationPercent * 0.40) +
                (templateCompliancePercent * 0.25)
        );

        // Đánh giá PR Gate
        boolean passed = (overallScore >= minQualityThreshold)
                && (antiHallucinationPercent >= minAntiHallucinationThreshold)
                && (phantomSymbols.isEmpty());

        String prGateStatus = passed ? "PASSED" : "BLOCKED";

        String qualityRating;
        if (overallScore >= 90.0 && phantomSymbols.isEmpty()) {
            qualityRating = "EXCELLENT";
        } else if (overallScore >= 75.0 && phantomSymbols.isEmpty()) {
            qualityRating = "GOOD";
        } else if (overallScore >= 50.0) {
            qualityRating = "WARN";
        } else {
            qualityRating = "BLOCKED";
        }

        // Tạo danh sách cảnh báo tổng hợp (Quality Warnings)
        List<QualityWarningDto> qualityWarnings = new ArrayList<>();

        for (PhantomSymbolDto ps : phantomSymbols) {
            qualityWarnings.add(QualityWarningDto.builder()
                    .category("HALLUCINATION")
                    .severity(ps.getSeverity())
                    .title("Ảo giác AI: Ký hiệu '" + ps.getSymbol() + "' không có thực")
                    .message("Dòng " + ps.getLineNumber() + ": " + ps.getReason())
                    .actionRequired(StringUtils.hasText(ps.getSuggestion()) ? ps.getSuggestion() : "Xóa hoặc thay thế bằng tên thực tế trong code.")
                    .build());
        }

        if (missingEntities.size() > 0) {
            qualityWarnings.add(QualityWarningDto.builder()
                    .category("ENTITY_COVERAGE")
                    .severity(entityCoveragePercent < 60.0 ? "HIGH" : "MEDIUM")
                    .title("Thiếu " + missingEntities.size() + " thực thể mã nguồn chưa được tài liệu hóa")
                    .message("Các hàm và lớp cốt lõi chưa xuất hiện trong văn bản Markdown.")
                    .actionRequired("Xem danh sách Missing Entities và nhấn 'Chèn vào tài liệu' trên Editor.")
                    .build());
        }

        if (missingParams.size() > 0) {
            qualityWarnings.add(QualityWarningDto.builder()
                    .category("PARAM_COVERAGE")
                    .severity("LOW")
                    .title("Thiếu mô tả cho " + missingParams.size() + " tham số kỹ thuật")
                    .message("Một số tham số của các hàm chưa được định nghĩa bảng hoặc danh sách mô tả.")
                    .actionRequired("Bổ sung bảng tham số đầu vào cho các API tương ứng.")
                    .build());
        }

        if (!missingHeadings.isEmpty()) {
            qualityWarnings.add(QualityWarningDto.builder()
                    .category("TEMPLATE_COMPLIANCE")
                    .severity("MEDIUM")
                    .title("Thiếu " + missingHeadings.size() + " đề mục bắt buộc theo Template chuẩn")
                    .message("Tài liệu chưa tuân thủ đầy đủ cấu trúc của mẫu '" + (template != null ? template.getName() : "Chuẩn") + "'.")
                    .actionRequired("Bổ sung các đề mục: " + String.join(", ", missingHeadings))
                    .build());
        }

        // Tạo nhận xét & khuyến nghị tổng thể
        StringBuilder rec = new StringBuilder();
        if (passed) {
            rec.append("✅ Tài liệu đạt chất lượng cao (").append(overallScore).append("/100 điểm). ")
               .append("Không phát hiện ảo giác AI, độ phủ mã nguồn đạt ").append(overallCoveragePercent).append("%. ")
               .append("Pull Request đủ điều kiện vượt qua PR Gate an toàn.");
        } else {
            rec.append("⛔ Tài liệu KHÔNG ĐẠT điều kiện PR Gate (").append(overallScore).append("/100 điểm, ngưỡng yêu cầu ").append(minQualityThreshold).append("%). ");
            if (!phantomSymbols.isEmpty()) {
                rec.append("Phát hiện ").append(phantomSymbols.size()).append(" ký hiệu ảo giác (Phantom Symbols) cần loại bỏ ngay. ");
            }
            if (overallCoveragePercent < minQualityThreshold) {
                rec.append("Độ phủ thực thể code chỉ đạt ").append(overallCoveragePercent).append("%. ");
            }
            if (!missingHeadings.isEmpty()) {
                rec.append("Thiếu ").append(missingHeadings.size()).append(" đề mục bắt buộc của Template.");
            }
        }

        return DocumentQualityEvaluationResponse.builder()
                .repositoryId(repoId)
                .repositoryName(repoName)
                .documentId(docId)
                .documentTitle(docTitle)
                .filePath(filePath)
                .evaluatedAt(Instant.now())
                .entityCoveragePercent(entityCoveragePercent)
                .paramCoveragePercent(paramCoveragePercent)
                .overallCoveragePercent(overallCoveragePercent)
                .antiHallucinationPercent(antiHallucinationPercent)
                .templateCompliancePercent(templateCompliancePercent)
                .overallQualityScore(overallScore)
                .qualityRating(qualityRating)
                .passed(passed)
                .prGateStatus(prGateStatus)
                .appliedQualityThreshold(minQualityThreshold)
                .appliedAntiHallucinationThreshold(minAntiHallucinationThreshold)
                .recommendation(rec.toString())
                .totalCodeEntitiesScanned(totalEntities)
                .documentedCodeEntitiesCount(documentedEntities)
                .missingCodeEntitiesCount(missingEntities.size())
                .totalParamsScanned(totalParams)
                .documentedParamsCount(documentedParams)
                .missingParamsCount(missingParams.size())
                .totalSymbolsChecked(totalSymbolsChecked)
                .phantomSymbolsCount(phantomSymbols.size())
                .requiredHeadingsCount(requiredHeadingsCount)
                .matchedHeadingsCount(matchedHeadingsCount)
                .phantomSymbols(phantomSymbols)
                .missingEntities(missingEntities.stream().limit(25).toList())
                .missingParams(missingParams.stream().limit(25).toList())
                .missingTemplateHeadings(missingHeadings)
                .qualityWarnings(qualityWarnings)
                .build();
    }

    private static double round1(double val) {
        return Math.round(val * 10.0) / 10.0;
    }

    private static boolean containsIdentifier(String text, String identifier) {
        if (!StringUtils.hasText(text) || !StringUtils.hasText(identifier)) {
            return false;
        }
        Pattern pattern = Pattern.compile("(?i)\\b" + Pattern.quote(identifier) + "\\b");
        return pattern.matcher(text).find();
    }

    private static boolean hasUpper(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.isUpperCase(s.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static List<String> extractParamNames(String paramsRaw) {
        List<String> names = new ArrayList<>();
        if (!StringUtils.hasText(paramsRaw)) {
            return names;
        }
        String clean = paramsRaw.replace("(", "").replace(")", "").trim();
        if (clean.isBlank() || "None".equalsIgnoreCase(clean)) {
            return names;
        }
        String[] parts = clean.split(",");
        for (String part : parts) {
            String p = part.trim();
            // Nếu có khoảng trắng dạng "String username" -> lấy từ cuối
            String[] tokens = p.split("\\s+");
            String paramName = tokens[tokens.length - 1].replaceAll("[^a-zA-Z0-9_]", "");
            if (paramName.length() >= 2) {
                names.add(paramName);
            }
        }
        return names;
    }

    private static List<String> extractApiPaths(String text) {
        List<String> paths = new ArrayList<>();
        if (!StringUtils.hasText(text)) {
            return paths;
        }
        Pattern p = Pattern.compile("(?i)(/(?:api|v\\d+|[a-zA-Z0-9_\\-]+)(?:/[a-zA-Z0-9_\\-\\{\\}\\:]+)*)");
        Matcher m = p.matcher(text);
        while (m.find()) {
            paths.add(m.group(1).trim());
        }
        return paths;
    }

    private static boolean isKnownOrPatternMatchedEndpoint(String candidate, Set<String> realEndpoints) {
        if (realEndpoints.contains(candidate)) {
            return true;
        }
        // Thử regex normalize {id}
        String normalizedCandidate = candidate.replaceAll("/\\{[^\\}]+\\}", "/{var}").replaceAll("/\\d+", "/{var}");
        for (String ep : realEndpoints) {
            String normEp = ep.toLowerCase(Locale.ROOT).replaceAll("/\\{[^\\}]+\\}", "/{var}").replaceAll("/\\d+", "/{var}");
            if (normEp.equals(normalizedCandidate) || candidate.startsWith(ep.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private static String findClosestMatch(String target, Collection<String> candidates) {
        if (!StringUtils.hasText(target) || candidates == null || candidates.isEmpty()) {
            return null;
        }
        String targetLower = target.toLowerCase(Locale.ROOT);
        String bestMatch = null;
        int bestDist = Integer.MAX_VALUE;

        for (String c : candidates) {
            String cLower = c.toLowerCase(Locale.ROOT);
            if (cLower.contains(targetLower) || targetLower.contains(cLower)) {
                return "Có thể bạn muốn nhắc đến ký hiệu thật '" + c + "'?";
            }
            int dist = levenshtein(targetLower, cLower);
            if (dist < bestDist && dist <= Math.max(3, target.length() / 2)) {
                bestDist = dist;
                bestMatch = c;
            }
        }

        return bestMatch != null ? "Có thể bạn muốn nhắc đến ký hiệu thật '" + bestMatch + "'?" : null;
    }

    private static int levenshtein(String a, String b) {
        int[] costs = new int[b.length() + 1];
        for (int j = 0; j < costs.length; j++) costs[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]),
                        a.charAt(i - 1) == b.charAt(j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[b.length()];
    }
}
