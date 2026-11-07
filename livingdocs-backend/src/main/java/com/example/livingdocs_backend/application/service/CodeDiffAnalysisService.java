package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPrFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service thực thi Pipeline kéo Git Diff thời gian thực và đối chiếu AST.
 * Tự động bóc tách các hàm bị thay đổi khi có PR (.java, .py, .ts).
 */
@Slf4j
@Service
public class CodeDiffAnalysisService implements CodeDiffAnalysisServicePort {

    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final CodeEntityRepositoryPort codeEntityRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataGitHubConnectionRepository connectionRepository;
    private final GitHubClientPort gitHubClient;
    private final RestClient restClient;

    private static final Set<String> RESERVED_KEYWORDS = Set.of(
            "if", "for", "while", "switch", "catch", "synchronized", "return", "throw", "new");

    @Autowired
    public CodeDiffAnalysisService(
            SpringDataDocumentChangeAlertRepository alertRepository,
            CodeEntityRepositoryPort codeEntityRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataGitHubConnectionRepository connectionRepository,
            GitHubClientPort gitHubClient,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl) {
        this.alertRepository = alertRepository;
        this.codeEntityRepository = codeEntityRepository;
        this.repositoryRepository = repositoryRepository;
        this.connectionRepository = connectionRepository;
        this.gitHubClient = gitHubClient;
        org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(2000);
        requestFactory.setReadTimeout(5000);
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .baseUrl(aiEngineUrl)
                .build();
    }

    public CodeDiffAnalysisService(
            SpringDataDocumentChangeAlertRepository alertRepository,
            CodeEntityRepositoryPort codeEntityRepository,
            String aiEngineUrl) {
        this(alertRepository, codeEntityRepository, null, null, null, aiEngineUrl);
    }

    public CodeDiffAnalysisService(
            SpringDataDocumentChangeAlertRepository alertRepository,
            CodeEntityRepositoryPort codeEntityRepository,
            SpringDataRepositoryRepository repositoryRepository,
            SpringDataGitHubConnectionRepository connectionRepository,
            GitHubClientPort gitHubClient,
            RestClient restClient) {
        this.alertRepository = alertRepository;
        this.codeEntityRepository = codeEntityRepository;
        this.repositoryRepository = repositoryRepository;
        this.connectionRepository = connectionRepository;
        this.gitHubClient = gitHubClient;
        this.restClient = restClient;
    }

    public CodeDiffAnalysisService(
            SpringDataDocumentChangeAlertRepository alertRepository,
            CodeEntityRepositoryPort codeEntityRepository,
            RestClient restClient) {
        this.alertRepository = alertRepository;
        this.codeEntityRepository = codeEntityRepository;
        this.repositoryRepository = null;
        this.connectionRepository = null;
        this.gitHubClient = null;
        this.restClient = restClient;
    }

    @Override
    public AstDiffRequestDto fetchPullRequestDiff(Long repositoryId, int prNumber) {
        log.info("[CodeDiffPipeline] Kéo Git Diff thời gian thực cho PR #{} tại repository ID={}", prNumber,
                repositoryId);

        if (repositoryRepository == null || gitHubClient == null) {
            log.warn(
                    "[CodeDiffPipeline] RepositoryRepository hoặc GitHubClient chưa được khởi tạo. Trả về cấu trúc trống.");
            return AstDiffRequestDto.builder()
                    .repository_id(repositoryId)
                    .pr_number(prNumber)
                    .files(Collections.emptyList())
                    .build();
        }

        RepositoryEntity repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy repository với ID: " + repositoryId));

        String repoFullName = repo.getRepoFullName();
        String[] parts = repoFullName != null ? repoFullName.split("/") : new String[0];
        if (parts.length != 2) {
            throw new IllegalArgumentException(
                    "Tên repository không hợp lệ (yêu cầu dạng owner/repo): " + repoFullName);
        }
        String owner = parts[0];
        String repoName = parts[1];

        String token = resolveGitHubToken(repo);

        // 1. Gọi GitHub API lấy thông tin PR (Base commit SHA & Head commit SHA)
        GitHubPullRequestDto prDto = gitHubClient.getPullRequest(token, owner, repoName, prNumber);
        if (prDto == null) {
            throw new IllegalStateException(
                    String.format("Không thể lấy thông tin PR #%d từ GitHub cho repo %s", prNumber, repoFullName));
        }

        String baseSha = prDto.baseCommitSha();
        String headSha = prDto.headCommitSha();
        log.info("[CodeDiffPipeline] PR #{} ({}/{}): Base SHA={}, Head SHA={}", prNumber, owner, repoName, baseSha,
                headSha);

        // 2. Gọi GitHub API lấy danh sách các file bị sửa đổi trong PR
        List<GitHubPrFileDto> prFiles = gitHubClient.getPullRequestFiles(token, owner, repoName, prNumber);
        log.info("[CodeDiffPipeline] PR #{} có tổng cộng {} files bị thay đổi trên GitHub", prNumber, prFiles.size());

        // 3. Lọc các file nguồn .java, .py, .ts, .tsx, .js
        List<AstDiffRequestDto.FileDiffItemDto> diffFiles = new ArrayList<>();
        for (GitHubPrFileDto file : prFiles) {
            String filename = file.filename();
            if (!isSupportedSourceFile(filename)) {
                continue;
            }

            String status = file.status() != null ? file.status().toLowerCase() : "modified";
            String baseCode = "";
            String headCode = "";

            if ("removed".equals(status)) {
                // File bị xóa: chỉ có base_code, head_code rỗng
                baseCode = gitHubClient.getFileContent(token, owner, repoName, filename, baseSha);
            } else if ("added".equals(status)) {
                // File mới thêm: base_code rỗng, chỉ có head_code
                headCode = gitHubClient.getFileContent(token, owner, repoName, filename, headSha);
            } else {
                // File modified hoặc renamed
                String basePath = file.previousFilename() != null ? file.previousFilename() : filename;
                baseCode = gitHubClient.getFileContent(token, owner, repoName, basePath, baseSha);
                headCode = gitHubClient.getFileContent(token, owner, repoName, filename, headSha);
            }

            diffFiles.add(AstDiffRequestDto.FileDiffItemDto.builder()
                    .file_path(filename)
                    .base_code(baseCode != null ? baseCode : "")
                    .head_code(headCode != null ? headCode : "")
                    .build());
        }

        log.info("[CodeDiffPipeline] Đã kéo nội dung Base & Head cho {} file mã nguồn (.java, .py, .ts)",
                diffFiles.size());

        return AstDiffRequestDto.builder()
                .repository_id(repositoryId)
                .pr_number(prNumber)
                .base_commit_hash(baseSha)
                .head_commit_hash(headSha)
                .files(diffFiles)
                .build();
    }

    @Override
    public AstDiffResponseDto fetchAndAnalyzePullRequestDiff(Long repositoryId, int prNumber) {
        AstDiffRequestDto requestDto = fetchPullRequestDiff(repositoryId, prNumber);
        return analyzeAstDiff(requestDto);
    }

    @Override
    public AstDiffResponseDto analyzeAstDiff(AstDiffRequestDto requestDto) {
        log.info("[CodeDiffPipeline] Gửi yêu cầu đối chiếu AST sang AI Engine (/v1/ast/diff) cho repo={}, files={}",
                requestDto.repository_id(), requestDto.files() != null ? requestDto.files().size() : 0);

        try {
            return restClient.post()
                    .uri("/v1/ast/diff")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestDto)
                    .retrieve()
                    .body(AstDiffResponseDto.class);
        } catch (Exception ex) {
            log.warn(
                    "[CodeDiffPipeline] Không thể kết nối AI Engine (/v1/ast/diff) [{}]. Chuyển sang fallback AST Parser nội bộ.",
                    ex.getMessage());
            return fallbackAstDiff(requestDto);
        }
    }

    @Override
    @Transactional
    public List<DocumentChangeAlertEntity> processPullRequestCodeDiff(Long repositoryId, Long prId,
            AstDiffRequestDto requestDto) {
        log.info("[CodeDiffPipeline] Bắt đầu quy trình đối chiếu Code cho PR #{}, repo={}", prId, repositoryId);

        AstDiffResponseDto diffResponse = analyzeAstDiff(requestDto);
        if (diffResponse == null || diffResponse.files() == null || diffResponse.files().isEmpty()) {
            log.warn("[CodeDiffPipeline] Không có kết quả đối chiếu nào từ PR #{}", prId);
            return List.of();
        }

        List<DocumentChangeAlertEntity> createdAlerts = new ArrayList<>();
        Instant now = Instant.now();

        for (AstDiffResponseDto.FileDiffResultDto fileRes : diffResponse.files()) {
            String filePath = fileRes.file_path();
            log.info("[CodeDiffPipeline] File [{}]: Trạng thái={}, số hàm bị ảnh hưởng={}",
                    filePath, fileRes.file_status(), fileRes.total_affected());

            for (AstDiffResponseDto.AffectedEntityItemDto entity : fileRes.affected_entities()) {
                String changeType = entity.change_type(); // DELETED, ADDED, RENAMED, PARAM_CHANGED, etc.
                String classification = mapClassification(changeType);
                String severity = entity.impact_level() != null ? entity.impact_level() : "MEDIUM";

                // Cập nhật trạng thái của entity trong CSDL (code_entities) nếu đã có
                if (codeEntityRepository != null) {
                    List<CodeEntity> existing = codeEntityRepository.findByRepositoryIdAndFilePath(repositoryId,
                            filePath);
                    for (CodeEntity ce : existing) {
                        if (entity.method_name().equals(ce.getMethodName())) {
                            ce.setDocStatus("DRIFTED");
                            codeEntityRepository.save(ce);
                        }
                    }
                }

                // Tạo Alert tương ứng trong bảng document_change_alerts
                DocumentChangeAlertEntity alert = DocumentChangeAlertEntity.builder()
                        .repositoryId(repositoryId)
                        .sourcePrId(prId)
                        .sourceCommit(requestDto.head_commit_hash())
                        .classification(classification)
                        .severity(severity)
                        .status("OPEN")
                        .details(String.format("[%s] Hàm '%s' tại file '%s': %s (Chữ ký cũ: %s -> Chữ ký mới: %s)",
                                changeType, entity.method_name(), filePath, entity.details(),
                                entity.old_signature() != null ? entity.old_signature() : "N/A",
                                entity.new_signature() != null ? entity.new_signature() : "N/A"))
                        .createdAt(now)
                        .build();

                createdAlerts.add(alert);
            }
        }

        List<DocumentChangeAlertEntity> saved = alertRepository.saveAll(createdAlerts);
        log.info("[CodeDiffPipeline] Hoàn tất đối chiếu PR #{}: Đã tạo {} cảnh báo trôi dạt vào CSDL.", prId,
                saved.size());
        return saved;
    }

    @Override
    public List<DocumentChangeAlertEntity> getAlertsByRepository(Long repositoryId) {
        return alertRepository.findByRepositoryId(repositoryId);
    }

    @Override
    public List<DocumentChangeAlertEntity> getAlertsByPr(Long prId) {
        return alertRepository.findBySourcePrId(prId);
    }

    private String mapClassification(String changeType) {
        if (changeType == null)
            return "SEMANTIC";
        return switch (changeType) {
            case "DELETED", "RENAMED" -> "REFERENCE";
            case "PARAM_CHANGED", "RETURN_TYPE_CHANGED", "SIGNATURE_CHANGED" -> "SIGNATURE";
            default -> "SEMANTIC";
        };
    }

    private boolean isSupportedSourceFile(String filename) {
        if (!StringUtils.hasText(filename))
            return false;
        String lower = filename.toLowerCase();
        return lower.endsWith(".java") || lower.endsWith(".py")
                || lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js");
    }

    private String resolveGitHubToken(RepositoryEntity repo) {
        if (connectionRepository != null && repo.getConnectionId() != null) {
            Optional<GitHubConnectionEntity> connOpt = connectionRepository.findById(repo.getConnectionId());
            if (connOpt.isPresent() && connOpt.get().getAccessTokenEncrypted() != null) {
                return connOpt.get().getAccessTokenEncrypted();
            }
        }
        return System.getenv("GITHUB_TOKEN");
    }

    private AstDiffResponseDto fallbackAstDiff(AstDiffRequestDto requestDto) {
        log.warn("[CodeDiffPipeline] Sử dụng fallback parser nội bộ cho đối chiếu AST.");
        List<AstDiffResponseDto.FileDiffResultDto> fileResults = new ArrayList<>();
        int totalAffected = 0;

        if (requestDto.files() != null) {
            for (AstDiffRequestDto.FileDiffItemDto f : requestDto.files()) {
                List<AstDiffResponseDto.AffectedEntityItemDto> affected = new ArrayList<>();
                String baseCode = f.base_code() != null ? f.base_code() : "";
                String headCode = f.head_code() != null ? f.head_code() : "";
                String filePath = f.file_path() != null ? f.file_path() : "UnknownFile";

                boolean baseHas = StringUtils.hasText(baseCode);
                boolean headHas = StringUtils.hasText(headCode);

                if (baseHas && !headHas) {
                    affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                            .entity_type("FILE")
                            .class_name(extractClassName(filePath))
                            .method_name("EntireFile")
                            .change_type("DELETED")
                            .impact_level("CRITICAL")
                            .details("File mã nguồn bị xóa hoàn toàn khỏi repository.")
                            .build());
                } else if (!baseHas && headHas) {
                    affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                            .entity_type("FILE")
                            .class_name(extractClassName(filePath))
                            .method_name("EntireFile")
                            .change_type("ADDED")
                            .impact_level("LOW")
                            .details("File mã nguồn mới được thêm vào repository.")
                            .build());
                } else if (baseHas && headHas) {
                    extractMethodDiffs(filePath, baseCode, headCode, affected);
                }

                int added = (int) affected.stream().filter(a -> "ADDED".equals(a.change_type())).count();
                int deleted = (int) affected.stream().filter(a -> "DELETED".equals(a.change_type())).count();
                int renamed = (int) affected.stream().filter(a -> "RENAMED".equals(a.change_type())).count();
                int modified = affected.size() - added - deleted - renamed;

                fileResults.add(AstDiffResponseDto.FileDiffResultDto.builder()
                        .file_path(filePath)
                        .class_name(extractClassName(filePath))
                        .file_status(affected.isEmpty() ? "UNCHANGED"
                                : (baseHas && !headHas ? "DELETED" : (!baseHas && headHas ? "ADDED" : "MODIFIED")))
                        .total_affected(affected.size())
                        .summary(AstDiffResponseDto.DiffSummaryDto.builder()
                                .added(added)
                                .deleted(deleted)
                                .renamed(renamed)
                                .modified(Math.max(0, modified))
                                .build())
                        .affected_entities(affected)
                        .build());
                totalAffected += affected.size();
            }
        }

        return AstDiffResponseDto.builder()
                .status("fallback")
                .repository_id(requestDto.repository_id())
                .pr_number(requestDto.pr_number())
                .base_commit_hash(requestDto.base_commit_hash())
                .head_commit_hash(requestDto.head_commit_hash())
                .total_files_analyzed(fileResults.size())
                .total_affected_entities(totalAffected)
                .files(fileResults)
                .build();
    }

    private void extractMethodDiffs(String filePath, String baseCode, String headCode,
            List<AstDiffResponseDto.AffectedEntityItemDto> affected) {
        String className = extractClassName(filePath);
        Map<String, String> baseMethods = parseMethodsFromCode(filePath, baseCode);
        Map<String, String> headMethods = parseMethodsFromCode(filePath, headCode);

        // 1. Kiểm tra các hàm bị xóa (có ở base nhưng mất ở head) -> CRITICAL
        for (Map.Entry<String, String> entry : baseMethods.entrySet()) {
            String mName = entry.getKey();
            if (!headMethods.containsKey(mName)) {
                affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                        .entity_type("METHOD")
                        .class_name(className)
                        .method_name(mName)
                        .change_type("DELETED")
                        .impact_level("CRITICAL")
                        .old_signature(entry.getValue())
                        .details(String.format("Hàm '%s' bị xóa khỏi file '%s'", mName, filePath))
                        .build());
            }
        }

        // 2. Kiểm tra các hàm thêm mới (LOW) hoặc đổi chữ ký tham số (HIGH)
        for (Map.Entry<String, String> entry : headMethods.entrySet()) {
            String mName = entry.getKey();
            String headSig = entry.getValue();

            if (!baseMethods.containsKey(mName)) {
                affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                        .entity_type("METHOD")
                        .class_name(className)
                        .method_name(mName)
                        .change_type("ADDED")
                        .impact_level("LOW")
                        .new_signature(headSig)
                        .details(String.format("Hàm mới '%s' được thêm vào file '%s'", mName, filePath))
                        .build());
            } else {
                String baseSig = baseMethods.get(mName);
                if (!baseSig.equals(headSig)) {
                    affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                            .entity_type("METHOD")
                            .class_name(className)
                            .method_name(mName)
                            .change_type("PARAM_CHANGED")
                            .impact_level("HIGH")
                            .old_signature(baseSig)
                            .new_signature(headSig)
                            .details(String.format("Chữ ký tham số của hàm '%s' bị thay đổi: '%s' -> '%s'", mName,
                                    baseSig, headSig))
                            .build());
                }
            }
        }
    }

    private Map<String, String> parseMethodsFromCode(String filePath, String code) {
        Map<String, String> methods = new LinkedHashMap<>();
        if (!StringUtils.hasText(code))
            return methods;

        String lower = filePath.toLowerCase();
        Pattern pattern;
        if (lower.endsWith(".py")) {
            // Python: def function_name(args):
            pattern = Pattern.compile("def\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(([^)]*)\\)\\s*:");
        } else if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js")) {
            // TypeScript/JavaScript: function name(args) hoặc const name = (args) =>
            pattern = Pattern.compile(
                    "(?:function\\s+([a-zA-Z_][a-zA-Z0-9_]*)|(?:const|let|var)\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*(?:async\\s*)?)\\s*\\(([^)]*)\\)");
        } else {
            // Java: [modifiers] [return_type] methodName(param1, param2)
            pattern = Pattern.compile(
                    "(?:public|protected|private|static|final|synchronized|abstract|default|native|\\s)+[\\w<>\\[\\],\\s]+\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*[{;]");
        }

        Matcher matcher = pattern.matcher(code);
        while (matcher.find()) {
            String mName = matcher.group(1);
            if (mName == null && matcher.groupCount() >= 2) {
                mName = matcher.group(2);
            }
            if (mName != null && !RESERVED_KEYWORDS.contains(mName.toLowerCase())) {
                String params = matcher.group(matcher.groupCount()).trim().replaceAll("\\s+", " ");
                methods.put(mName, mName + "(" + params + ")");
            }
        }
        return methods;
    }

    private String extractClassName(String filePath) {
        if (!StringUtils.hasText(filePath))
            return "UnknownClass";
        int lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        String name = lastSlash != -1 ? filePath.substring(lastSlash + 1) : filePath;
        int dot = name.lastIndexOf('.');
        return dot != -1 ? name.substring(0, dot) : name;
    }
}
