package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/code-diff")
@RequiredArgsConstructor
@Tag(name = "Code Diff Pipeline", description = "Bộ kéo Git Diff thời gian thực và Đối chiếu AST (Tự động bóc tách hàm thay đổi khi có PR)")
public class CodeDiffController {

    private final CodeDiffAnalysisServicePort codeDiffAnalysisService;
    private final DocDriftDetectionServicePort docDriftDetectionService;

    @PostMapping("/analyze")
    @Operation(summary = "Đối chiếu AST trực tiếp giữa các file mã nguồn (.java, .py, .ts) gửi qua Request Body")
    public ResponseEntity<AstDiffResponseDto> analyzeDiff(@RequestBody AstDiffRequestDto requestDto) {
        AstDiffResponseDto response = codeDiffAnalysisService.analyzeAstDiff(requestDto);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/repositories/{repositoryId}/pull-requests/{prNumber}/pull-diff")
    @Operation(summary = "Kéo Git Diff thời gian thực từ GitHub API cho PR (lấy danh sách file .java, .py, .ts và code Base/Head)")
    public ResponseEntity<AstDiffRequestDto> pullDiff(
            @PathVariable Long repositoryId,
            @PathVariable int prNumber) {
        AstDiffRequestDto diffDto = codeDiffAnalysisService.fetchPullRequestDiff(repositoryId, prNumber);
        return ResponseEntity.ok(diffDto);
    }

    @PostMapping("/repositories/{repositoryId}/pull-requests/{prNumber}/pull-and-analyze")
    @Operation(summary = "Tự động kéo Git Diff từ GitHub và gửi sang AI Engine /v1/ast/diff để bóc tách các hàm bị thay đổi")
    public ResponseEntity<AstDiffResponseDto> pullAndAnalyze(
            @PathVariable Long repositoryId,
            @PathVariable int prNumber) {
        AstDiffResponseDto response = codeDiffAnalysisService.fetchAndAnalyzePullRequestDiff(repositoryId, prNumber);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/repositories/{repositoryId}/pull-requests/{prNumber}/affected-documents")
    @Operation(summary = "Quy trình hoàn chỉnh: Tự động kéo Diff từ GitHub, đối chiếu AST và truy vấn doc_code_links trả về AffectedDocumentResultDto kèm mức độ nghiêm trọng")
    public ResponseEntity<List<AffectedDocumentResultDto>> getAffectedDocumentsForPr(
            @PathVariable Long repositoryId,
            @PathVariable int prNumber) {
        List<AffectedDocumentResultDto> result = docDriftDetectionService
                .findAffectedDocumentsForPullRequest(repositoryId, prNumber);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/repositories/{repositoryId}/affected-docs")
    @Operation(summary = "Truy vấn danh sách tài liệu bị ảnh hưởng từ doc_code_links theo payload đối chiếu gửi lên (Test độc lập)")
    public ResponseEntity<List<AffectedDocumentResultDto>> getAffectedDocuments(
            @PathVariable Long repositoryId,
            @RequestBody AstDiffRequestDto requestDto) {
        List<AffectedDocumentResultDto> result = docDriftDetectionService.findAffectedDocuments(repositoryId,
                requestDto);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/pull-requests/{prId}/analyze")
    @Operation(summary = "Chạy pipeline đối chiếu code cho Pull Request và tự động tạo cảnh báo sai lệch tài liệu")
    public ResponseEntity<List<DocumentChangeAlertEntity>> processPrDiff(
            @PathVariable Long prId,
            @RequestParam Long repositoryId,
            @RequestBody AstDiffRequestDto requestDto) {
        List<DocumentChangeAlertEntity> alerts = codeDiffAnalysisService.processPullRequestCodeDiff(repositoryId, prId,
                requestDto);
        return ResponseEntity.ok(alerts);
    }

    @PostMapping("/repositories/{repositoryId}/pull-requests/{prNumber}/drift-comment")
    @Operation(summary = "Tìm tài liệu bị ảnh hưởng qua doc_code_links, tạo drift_alerts và tự động đăng comment cảnh báo lên PR")
    public ResponseEntity<PrDriftAnalysisResultDto> detectDriftAndComment(
            @PathVariable Long repositoryId,
            @PathVariable int prNumber,
            @RequestBody(required = false) AstDiffRequestDto requestDto) {
        PrDriftAnalysisResultDto result;
        if (requestDto != null && requestDto.files() != null && !requestDto.files().isEmpty()) {
            result = docDriftDetectionService.detectDriftAndCommentOnPr(repositoryId, prNumber, requestDto);
        } else {
            result = docDriftDetectionService.detectDriftAndCommentOnPr(repositoryId, prNumber);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/repositories/{repositoryId}/alerts")
    @Operation(summary = "Lấy danh sách các cảnh báo trôi dạt tài liệu phát hiện được theo kho lưu trữ")
    public ResponseEntity<List<DocumentChangeAlertEntity>> getAlertsByRepo(@PathVariable Long repositoryId) {
        List<DocumentChangeAlertEntity> alerts = codeDiffAnalysisService.getAlertsByRepository(repositoryId);
        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/pull-requests/{prId}/alerts")
    @Operation(summary = "Lấy danh sách các cảnh báo trôi dạt tài liệu phát hiện được theo Pull Request")
    public ResponseEntity<List<DocumentChangeAlertEntity>> getAlertsByPr(@PathVariable Long prId) {
        List<DocumentChangeAlertEntity> alerts = codeDiffAnalysisService.getAlertsByPr(prId);
        return ResponseEntity.ok(alerts);
    }
}
