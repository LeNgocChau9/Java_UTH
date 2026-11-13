package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ManagerActionRequest;
import com.example.livingdocs_backend.application.dto.ReviewActionResponse;
import com.example.livingdocs_backend.application.dto.ReviewQueueItemResponse;
import com.example.livingdocs_backend.application.dto.StaffActionRequest;
import com.example.livingdocs_backend.application.port.ReviewServicePort;
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

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Reviews - Hàng đợi Staff & Manager", description = "Bộ API phục vụ Hàng đợi rà soát tài liệu của Staff và phê duyệt xuất bản của Manager")
public class ReviewController {

    private final ReviewServicePort reviewServicePort;

    @GetMapping("/staff/queue")
    @PreAuthorize("hasAnyRole('STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Lấy hàng đợi rà soát của Staff", description = "Lấy danh sách toàn bộ tài liệu đang ở trạng thái UNDER_REVIEW_STAFF kèm thông tin tác giả và kho lưu trữ (repo).")
    public ResponseEntity<List<ReviewQueueItemResponse>> getStaffQueue() {
        return ResponseEntity.ok(reviewServicePort.getStaffQueue());
    }

    @PostMapping("/{id}/staff-action")
    @PreAuthorize("hasAnyRole('STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Xử lý hành động của Staff", description = "Staff hoặc Manager duyệt cấp 1 (chuyển sang UNDER_REVIEW_MANAGER kèm ghi chú) hoặc từ chối (chuyển sang REJECTED).")
    public ResponseEntity<ReviewActionResponse> handleStaffAction(
            @PathVariable Long id,
            @RequestBody(required = false) StaffActionRequest request,
            @RequestHeader(value = "X-Role", required = false) String roleHeader,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorEmail = userPrincipal != null ? userPrincipal.getEmail() : null;
        String actorRole = principalRole(userPrincipal);
        if (actorRole == null) {
            actorRole = resolveRole(null, request != null ? request.getActorRole() : null, roleHeader, "STAFF");
        }

        return ResponseEntity.ok(reviewServicePort.handleStaffAction(id, request, actorId, actorRole, actorEmail));
    }

    @GetMapping("/manager/queue")
    @PreAuthorize("hasAnyRole('MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Lấy hàng đợi phê duyệt của Manager", description = "Tài liệu Staff đã duyệt (UNDER_REVIEW_MANAGER), kèm nhận xét Staff. Chỉ xuất bản khi Manager đồng ý.")
    public ResponseEntity<List<ReviewQueueItemResponse>> getManagerQueue() {
        return ResponseEntity.ok(reviewServicePort.getManagerQueue());
    }

    @PostMapping("/{id}/manager-action")
    @PreAuthorize("hasAnyRole('MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Phê duyệt cấp cuối của Manager", description = "PUBLISH chuyển PUBLISHED. commitToGithub=true thì đẩy file .md lên branch mặc định qua GitHub Contents API. RETURN_STAFF yêu cầu sửa. REJECT từ chối. Vai trò lấy từ JWT.")
    public ResponseEntity<ReviewActionResponse> handleManagerAction(
            @PathVariable Long id,
            @RequestBody(required = false) ManagerActionRequest request,
            @RequestHeader(value = "X-Role", required = false) String roleHeader,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorEmail = userPrincipal != null ? userPrincipal.getEmail() : null;
        String actorRole = principalRole(userPrincipal);
        if (actorRole == null) {
            actorRole = resolveRole(null, request != null ? request.getActorRole() : null, roleHeader, "MANAGER");
        }

        return ResponseEntity.ok(reviewServicePort.handleManagerAction(id, request, actorId, actorRole, actorEmail));
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Lấy lịch sử xem xét tài liệu", description = "Trả về toàn bộ các bản ghi duyệt/từ chối tài liệu từ trước đến nay.")
    public ResponseEntity<List<com.example.livingdocs_backend.application.dto.ReviewHistoryItemResponse>> getReviewHistory() {
        return ResponseEntity.ok(reviewServicePort.getReviewHistory());
    }

    @GetMapping("/policies")
    @PreAuthorize("hasAnyRole('STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Lấy danh sách chính sách phê duyệt", description = "Lấy cấu hình phê duyệt 1 cấp vs 2 cấp dựa trên doc_type.")
    public ResponseEntity<List<com.example.livingdocs_backend.application.dto.ApprovalPolicyDto>> getPolicies() {
        return ResponseEntity.ok(reviewServicePort.getApprovalPolicies());
    }

    @PutMapping("/policies")
    @PreAuthorize("hasAnyRole('MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Cập nhật chính sách phê duyệt", description = "Cập nhật số cấp phê duyệt (1 hoặc 2) cho từng loại tài liệu.")
    public ResponseEntity<List<com.example.livingdocs_backend.application.dto.ApprovalPolicyDto>> updatePolicies(
            @RequestBody List<com.example.livingdocs_backend.application.dto.ApprovalPolicyDto> policies,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorEmail = userPrincipal != null ? userPrincipal.getEmail() : null;
        return ResponseEntity.ok(reviewServicePort.updateApprovalPolicies(policies, actorId, actorEmail));
    }

    @GetMapping("/delegations")
    @PreAuthorize("hasAnyRole('STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Lấy danh sách ủy quyền Manager", description = "Lấy danh sách các ủy quyền quyền duyệt giữa các Quản lý.")
    public ResponseEntity<List<com.example.livingdocs_backend.application.dto.ManagerDelegationDto>> getDelegations() {
        return ResponseEntity.ok(reviewServicePort.getManagerDelegations());
    }

    @PostMapping("/delegations")
    @PreAuthorize("hasAnyRole('MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Tạo mới ủy quyền phê duyệt Manager", description = "Quản lý ủy quyền quyền duyệt cho Quản lý khác trong khoảng thời gian xác định.")
    public ResponseEntity<com.example.livingdocs_backend.application.dto.ManagerDelegationDto> createDelegation(
            @RequestBody com.example.livingdocs_backend.application.dto.ManagerDelegationDto delegation,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorEmail = userPrincipal != null ? userPrincipal.getEmail() : null;
        return ResponseEntity.ok(reviewServicePort.createManagerDelegation(delegation, actorId, actorEmail));
    }

    private String principalRole(UserPrincipal userPrincipal) {
        if (userPrincipal == null || userPrincipal.getAuthorities() == null || userPrincipal.getAuthorities().isEmpty()) {
            return null;
        }
        String auth = userPrincipal.getAuthorities().iterator().next().getAuthority();
        return auth.startsWith("ROLE_") ? auth.substring(5) : auth;
    }

    private String resolveRole(UserPrincipal userPrincipal, String requestRole, String headerRole, String defaultRole) {
        if (requestRole != null && !requestRole.isBlank()) {
            return requestRole.trim().toUpperCase();
        }
        if (headerRole != null && !headerRole.isBlank()) {
            return headerRole.trim().toUpperCase();
        }
        if (userPrincipal != null && userPrincipal.getAuthorities() != null && !userPrincipal.getAuthorities().isEmpty()) {
            String auth = userPrincipal.getAuthorities().iterator().next().getAuthority();
            return auth.startsWith("ROLE_") ? auth.substring(5) : auth;
        }
        return defaultRole;
    }
}
