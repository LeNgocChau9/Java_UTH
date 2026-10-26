package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Service thực thi Pipeline đối chiếu Code phát hiện hàm thay đổi từ Pull Request.
 * TV2 - LivingDocs Code Diff Pipeline.
 */
@Slf4j
@Service
public class CodeDiffAnalysisService implements CodeDiffAnalysisServicePort {

    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final CodeEntityRepositoryPort codeEntityRepository;
    private final RestClient restClient;

    @Autowired
    public CodeDiffAnalysisService(
            SpringDataDocumentChangeAlertRepository alertRepository,
            CodeEntityRepositoryPort codeEntityRepository,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl
    ) {
        this.alertRepository = alertRepository;
        this.codeEntityRepository = codeEntityRepository;
        this.restClient = RestClient.builder()
                .baseUrl(aiEngineUrl)
                .build();
    }

    public CodeDiffAnalysisService(
            SpringDataDocumentChangeAlertRepository alertRepository,
            CodeEntityRepositoryPort codeEntityRepository,
            RestClient restClient
    ) {
        this.alertRepository = alertRepository;
        this.codeEntityRepository = codeEntityRepository;
        this.restClient = restClient;
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
            log.error("[CodeDiffPipeline] Lỗi khi gọi AI Engine (/v1/ast/diff): {}", ex.getMessage(), ex);
            // Fallback: Nếu AI Engine chưa bật hoặc lỗi, phân tích nội bộ giả lập an toàn
            return fallbackAstDiff(requestDto);
        }
    }

    @Override
    @Transactional
    public List<DocumentChangeAlertEntity> processPullRequestCodeDiff(Long repositoryId, Long prId, AstDiffRequestDto requestDto) {
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
                List<CodeEntity> existing = codeEntityRepository.findByRepositoryIdAndFilePath(repositoryId, filePath);
                for (CodeEntity ce : existing) {
                    if (entity.method_name().equals(ce.getMethodName())) {
                        ce.setDocStatus("DRIFTED");
                        codeEntityRepository.save(ce);
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
        log.info("[CodeDiffPipeline] Hoàn tất đối chiếu PR #{}: Đã tạo {} cảnh báo trôi dạt vào CSDL.", prId, saved.size());
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
        return switch (changeType) {
            case "DELETED", "RENAMED" -> "REFERENCE";
            case "PARAM_CHANGED", "RETURN_TYPE_CHANGED", "SIGNATURE_CHANGED" -> "SIGNATURE";
            default -> "SEMANTIC";
        };
    }

    private AstDiffResponseDto fallbackAstDiff(AstDiffRequestDto requestDto) {
        log.warn("[CodeDiffPipeline] Sử dụng fallback parser nội bộ cho đối chiếu AST.");
        List<AstDiffResponseDto.FileDiffResultDto> fileResults = new ArrayList<>();
        int totalAffected = 0;

        if (requestDto.files() != null) {
            for (AstDiffRequestDto.FileDiffItemDto f : requestDto.files()) {
                List<AstDiffResponseDto.AffectedEntityItemDto> affected = new ArrayList<>();
                boolean baseHas = f.base_code() != null && !f.base_code().isBlank();
                boolean headHas = f.head_code() != null && !f.head_code().isBlank();

                if (baseHas && !headHas) {
                    affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                            .entity_type("CLASS")
                            .method_name("EntireFile")
                            .change_type("DELETED")
                            .impact_level("CRITICAL")
                            .details("File Java bị xóa hoàn toàn khỏi repository.")
                            .build());
                } else if (!baseHas && headHas) {
                    affected.add(AstDiffResponseDto.AffectedEntityItemDto.builder()
                            .entity_type("CLASS")
                            .method_name("EntireFile")
                            .change_type("ADDED")
                            .impact_level("LOW")
                            .details("File Java mới được thêm vào.")
                            .build());
                }

                fileResults.add(AstDiffResponseDto.FileDiffResultDto.builder()
                        .file_path(f.file_path())
                        .file_status(affected.isEmpty() ? "MODIFIED" : affected.get(0).change_type())
                        .total_affected(affected.size())
                        .summary(AstDiffResponseDto.DiffSummaryDto.builder().build())
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
}
