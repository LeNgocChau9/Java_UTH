package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/code-entities")
@RequiredArgsConstructor
@Tag(name = "Code Entities & Indexing", description = "API bóc tách AST, lập chỉ mục và đo lường độ bao phủ tài liệu Java")
public class CodeEntityController {

    private final CodeIndexServicePort codeIndexService;

    @Builder
    public record IndexFileRequest(
            Long repositoryId,
            String filePath,
            String sourceCode,
            String commitHash
    ) {}

    @PostMapping("/index")
    @Operation(summary = "Lập chỉ mục một file Java và lưu entities vào CSDL",
               description = "Gửi source code sang AI Engine (FastAPI), nhận kết quả Tree-sitter và lưu vào bảng code_entities.")
    public ResponseEntity<List<CodeEntity>> indexFile(@RequestBody IndexFileRequest request) {
        List<CodeEntity> saved = codeIndexService.indexFile(
                request.repositoryId(),
                request.filePath(),
                request.sourceCode(),
                request.commitHash()
        );
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/extract-preview")
    @Operation(summary = "Xem trước kết quả bóc tách AST từ AI Engine",
               description = "Chỉ gọi FastAPI /v1/ast/extract và trả về kết quả JSON mà không lưu vào DB.")
    public ResponseEntity<AstExtractResponseDto> extractPreview(@RequestBody IndexFileRequest request) {
        AstExtractResponseDto result = codeIndexService.extractAstRaw(
                request.repositoryId(),
                request.filePath(),
                request.sourceCode(),
                request.commitHash()
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/repository/{repositoryId}")
    @Operation(summary = "Lấy danh sách phần tử mã nguồn theo Repository ID")
    public ResponseEntity<List<CodeEntity>> getByRepository(@PathVariable Long repositoryId) {
        return ResponseEntity.ok(codeIndexService.getEntitiesByRepository(repositoryId));
    }

    @GetMapping("/repository/{repositoryId}/file")
    @Operation(summary = "Lấy danh sách phần tử mã nguồn theo file trong Repository")
    public ResponseEntity<List<CodeEntity>> getByFile(
            @PathVariable Long repositoryId,
            @RequestParam String filePath
    ) {
        return ResponseEntity.ok(codeIndexService.getEntitiesByFile(repositoryId, filePath));
    }

    @GetMapping("/repository/{repositoryId}/coverage")
    @Operation(summary = "Tính toán tỷ lệ bao phủ tài liệu (% Coverage) của toàn bộ Repository",
               description = "Đo lường số thực thể code đã có tài liệu (doc_status = 'DOCUMENTED') so với tổng số thực thể bóc tách được của repo.")
    public ResponseEntity<DocCoverageResponseDto> getRepositoryCoverage(@PathVariable Long repositoryId) {
        return ResponseEntity.ok(codeIndexService.calculateRepositoryCoverage(repositoryId));
    }

    @GetMapping("/repository/{repositoryId}/file/coverage")
    @Operation(summary = "Tính toán tỷ lệ bao phủ tài liệu (% Coverage) của một file cụ thể",
               description = "Đo lường số thực thể code đã có tài liệu trong file so với tổng số thực thể bóc tách được.")
    public ResponseEntity<DocCoverageResponseDto> getFileCoverage(
            @PathVariable Long repositoryId,
            @RequestParam String filePath
    ) {
        return ResponseEntity.ok(codeIndexService.calculateFileCoverage(repositoryId, filePath));
    }
}
