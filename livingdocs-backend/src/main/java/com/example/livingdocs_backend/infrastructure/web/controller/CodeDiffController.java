package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
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
@Tag(name = "Code Diff Pipeline", description = "API đối chiếu code và phát hiện hàm thay đổi từ Pull Request (Thành viên 2)")
public class CodeDiffController {

    private final CodeDiffAnalysisServicePort codeDiffAnalysisService;

    @PostMapping("/analyze")
    @Operation(summary = "Đối chiếu AST trực tiếp giữa các file mã nguồn Java (Base vs Head)")
    public ResponseEntity<AstDiffResponseDto> analyzeDiff(@RequestBody AstDiffRequestDto requestDto) {
        AstDiffResponseDto response = codeDiffAnalysisService.analyzeAstDiff(requestDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/pull-requests/{prId}/analyze")
    @Operation(summary = "Chạy pipeline đối chiếu code cho Pull Request và tự động tạo cảnh báo sai lệch tài liệu")
    public ResponseEntity<List<DocumentChangeAlertEntity>> processPrDiff(
            @PathVariable Long prId,
            @RequestParam Long repositoryId,
            @RequestBody AstDiffRequestDto requestDto
    ) {
        List<DocumentChangeAlertEntity> alerts = codeDiffAnalysisService.processPullRequestCodeDiff(repositoryId, prId, requestDto);
        return ResponseEntity.ok(alerts);
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
