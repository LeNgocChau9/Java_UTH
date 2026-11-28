package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.application.dto.job.RepoScanJobPayload;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/code-entities")
@PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
@RequiredArgsConstructor
@Tag(name = "Code Entities & Indexing", description = "API bóc tách AST, lập chỉ mục và đo lường độ bao phủ tài liệu Java")
public class CodeEntityController {

    private final CodeIndexServicePort codeIndexService;

    @Autowired(required = false)
    private JobQueue jobQueue;

    @Autowired(required = false)
    private ObjectMapper objectMapper;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Builder
    public record IndexFileRequest(
            Long repositoryId,
            String filePath,
            String sourceCode,
            String commitHash) {
    }

    @PostMapping("/index")
    @Operation(summary = "Lập chỉ mục một file Java và lưu entities vào CSDL", description = "Gửi source code sang AI Engine (FastAPI), nhận kết quả Tree-sitter và lưu vào bảng code_entities.")
    public ResponseEntity<List<CodeEntity>> indexFile(@RequestBody IndexFileRequest request) {
        List<CodeEntity> saved = codeIndexService.indexFile(
                request.repositoryId(),
                request.filePath(),
                request.sourceCode(),
                request.commitHash());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/extract-preview")
    @Operation(summary = "Xem trước kết quả bóc tách AST từ AI Engine", description = "Chỉ gọi FastAPI /v1/ast/extract và trả về kết quả JSON mà không lưu vào DB.")
    public ResponseEntity<AstExtractResponseDto> extractPreview(@RequestBody IndexFileRequest request) {
        AstExtractResponseDto result = codeIndexService.extractAstRaw(
                request.repositoryId(),
                request.filePath(),
                request.sourceCode(),
                request.commitHash());
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
            @RequestParam String filePath) {
        return ResponseEntity.ok(codeIndexService.getEntitiesByFile(repositoryId, filePath));
    }

    @GetMapping("/repository/{repositoryId}/coverage")
    @Operation(summary = "Tính toán tỷ lệ bao phủ tài liệu (% Coverage) của toàn bộ Repository", description = "Đo lường số thực thể code đã có tài liệu (doc_status = 'DOCUMENTED') so với tổng số thực thể bóc tách được của repo.")
    public ResponseEntity<DocCoverageResponseDto> getRepositoryCoverage(@PathVariable Long repositoryId) {
        return ResponseEntity.ok(codeIndexService.calculateRepositoryCoverage(repositoryId));
    }

    @PostMapping("/repository/{repositoryId}/scan")
    @Operation(summary = "Quét AST và đánh giá độ bao phủ toàn Repository", description = "Hỗ trợ ?async=true để đẩy tác vụ REPO_SCAN vào hàng đợi JobWorker và trả về jobId.")
    public ResponseEntity<?> scanRepository(
            @PathVariable Long repositoryId,
            @RequestParam(name = "branch", required = false) String branch,
            @RequestParam(name = "async", defaultValue = "false") boolean async,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        if (tenantAccessService != null) {
            tenantAccessService.requireRepositoryAccess(repositoryId);
        }
        if (async && jobQueue != null) {
            try {
                RepoScanJobPayload payload = RepoScanJobPayload.builder()
                        .repositoryId(repositoryId)
                        .branch(branch)
                        .actorId(userPrincipal != null ? userPrincipal.getUserId() : null)
                        .build();
                ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
                Job job = jobQueue.enqueue(Job.TYPE_REPO_SCAN, mapper.writeValueAsString(payload));
                return ResponseEntity.accepted().body(Map.of(
                        "jobId", job.getJobId(),
                        "status", job.getStatus().name(),
                        "type", job.getType(),
                        "repositoryId", repositoryId,
                        "streamUrl", "/api/jobs/" + job.getJobId() + "/stream",
                        "message", "Đã đẩy tác vụ quét AST toàn kho lưu trữ vào hàng đợi xử lý nền."
                ));
            } catch (Exception ex) {
                throw new RuntimeException("Không thể đẩy tác vụ REPO_SCAN vào hàng đợi: " + ex.getMessage(), ex);
            }
        }
        return ResponseEntity.ok(codeIndexService.calculateRepositoryCoverage(repositoryId));
    }

    @PostMapping("/scan")
    @Operation(summary = "Quét AST và đánh giá độ bao phủ toàn Repository (query param)", description = "Alias của /repository/{repositoryId}/scan, hỗ trợ ?async=true trả về jobId.")
    public ResponseEntity<?> scanRepositoryByParam(
            @RequestParam Long repositoryId,
            @RequestParam(name = "branch", required = false) String branch,
            @RequestParam(name = "async", defaultValue = "false") boolean async,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        return scanRepository(repositoryId, branch, async, userPrincipal);
    }

    @GetMapping("/repository/{repositoryId}/file/coverage")
    @Operation(summary = "Tính toán tỷ lệ bao phủ tài liệu (% Coverage) của một file cụ thể", description = "Đo lường số thực thể code đã có tài liệu trong file so với tổng số thực thể bóc tách được.")
    public ResponseEntity<DocCoverageResponseDto> getFileCoverage(
            @PathVariable Long repositoryId,
            @RequestParam String filePath) {
        return ResponseEntity.ok(codeIndexService.calculateFileCoverage(repositoryId, filePath));
    }

    @GetMapping("/gaps")
    @Operation(summary = "Lấy danh sách các khoảng trống tài liệu (Documentation Gaps) chưa có tài liệu", description = "Báo cáo chi tiết các Class, Interface, Method chưa có tài liệu tương ứng, hỗ trợ bộ lọc và nút sinh tài liệu AI một chạm.")
    public ResponseEntity<com.example.livingdocs_backend.application.dto.ai.DocGapSummaryDto> getDocumentationGaps(
            @RequestParam(value = "repositoryId", required = false) Long repositoryId,
            @RequestParam(value = "packagePath", required = false) String packagePath,
            @RequestParam(value = "entityType", required = false) String entityType,
            @RequestParam(value = "search", required = false) String search) {
        return ResponseEntity.ok(codeIndexService.getDocumentationGaps(repositoryId, packagePath, entityType, search));
    }

    @GetMapping("/repository/{repositoryId}/gaps")
    @Operation(summary = "Lấy danh sách khoảng trống tài liệu của một Repository cụ thể", description = "Lọc các phần tử chưa có tài liệu trong một kho lưu trữ chỉ định.")
    public ResponseEntity<com.example.livingdocs_backend.application.dto.ai.DocGapSummaryDto> getRepositoryDocumentationGaps(
            @PathVariable("repositoryId") Long repositoryId,
            @RequestParam(value = "packagePath", required = false) String packagePath,
            @RequestParam(value = "entityType", required = false) String entityType,
            @RequestParam(value = "search", required = false) String search) {
        return ResponseEntity.ok(codeIndexService.getDocumentationGaps(repositoryId, packagePath, entityType, search));
    }
}
