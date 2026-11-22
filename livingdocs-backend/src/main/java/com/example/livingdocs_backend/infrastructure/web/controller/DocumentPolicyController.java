package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.policy.DocumentChangePolicyDto;
import com.example.livingdocs_backend.application.dto.policy.DocumentUpdatePolicyDto;
import com.example.livingdocs_backend.application.dto.policy.PolicyEvaluationRequestDto;
import com.example.livingdocs_backend.application.dto.policy.PolicyEvaluationResponseDto;
import com.example.livingdocs_backend.application.service.DocumentPolicyService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/policies")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Policy Engine - Chính sách cập nhật tài liệu tự động", description = "Quản lý document_change_policies và document_update_policies")
public class DocumentPolicyController {

    private final DocumentPolicyService policyService;

    @GetMapping("/update")
    @Operation(summary = "Lấy danh sách quy tắc kích hoạt cập nhật (document_update_policies)")
    public ResponseEntity<List<DocumentUpdatePolicyDto>> getUpdatePolicies() {
        return ResponseEntity.ok(policyService.getAllUpdatePolicies());
    }

    @PostMapping("/update")
    @PreAuthorize("hasAnyRole('ADMIN', 'TECH_LEAD', 'MANAGER')")
    @Operation(summary = "Cập nhật hoặc thêm quy tắc kích hoạt (AUTO_UPDATE vs REVIEW theo Commit/PR/Merge)")
    public ResponseEntity<DocumentUpdatePolicyDto> saveUpdatePolicy(
            @RequestBody DocumentUpdatePolicyDto dto,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        return ResponseEntity.ok(policyService.saveUpdatePolicy(dto, userId));
    }

    @GetMapping("/change")
    @Operation(summary = "Lấy danh sách quy tắc thay đổi module (document_change_policies)")
    public ResponseEntity<List<DocumentChangePolicyDto>> getChangePolicies(
            @RequestParam(required = false) Long repositoryId,
            @RequestParam(required = false) Long workspaceId) {
        return ResponseEntity.ok(policyService.getChangePolicies(repositoryId, workspaceId));
    }

    @PostMapping("/change")
    @PreAuthorize("hasAnyRole('ADMIN', 'TECH_LEAD', 'MANAGER')")
    @Operation(summary = "Tạo hoặc cập nhật quy tắc thay đổi (module_pattern, threshold, auto_update_enabled)")
    public ResponseEntity<DocumentChangePolicyDto> saveChangePolicy(
            @RequestBody DocumentChangePolicyDto dto,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        return ResponseEntity.ok(policyService.saveChangePolicy(dto, userId));
    }

    @DeleteMapping("/change/{policyId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TECH_LEAD', 'MANAGER')")
    @Operation(summary = "Xóa quy tắc thay đổi module")
    public ResponseEntity<Map<String, Object>> deleteChangePolicy(@PathVariable Long policyId) {
        policyService.deleteChangePolicy(policyId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Đã xóa quy tắc chính sách ID: " + policyId));
    }

    @PostMapping("/evaluate")
    @Operation(summary = "Đánh giá chính sách thực tế (Test Policy Engine)")
    public ResponseEntity<PolicyEvaluationResponseDto> evaluatePolicy(
            @RequestBody PolicyEvaluationRequestDto req) {
        return ResponseEntity.ok(policyService.evaluatePolicy(req));
    }
}
