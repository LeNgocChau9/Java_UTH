package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.AdminUserResponse;
import com.example.livingdocs_backend.application.dto.AssignUsersToEnterpriseRequest;
import com.example.livingdocs_backend.application.dto.EnterpriseRequest;
import com.example.livingdocs_backend.application.dto.EnterpriseResponse;
import com.example.livingdocs_backend.application.service.AdminEnterpriseService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/enterprises")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Admin - Quản trị Doanh nghiệp", description = "API dành cho ADMIN: quản lý danh sách doanh nghiệp (Workspaces) và phân nhóm tài khoản")
public class AdminEnterpriseController {

    private final AdminEnterpriseService adminEnterpriseService;

    @GetMapping
    @Operation(summary = "Danh sách doanh nghiệp", description = "Trả về toàn bộ doanh nghiệp kèm số lượng tài khoản và số kho mã nguồn.")
    public ResponseEntity<List<EnterpriseResponse>> listEnterprises() {
        return ResponseEntity.ok(adminEnterpriseService.listEnterprises());
    }

    @PostMapping
    @Operation(summary = "Tạo doanh nghiệp mới", description = "Tạo doanh nghiệp mới (tên duy nhất không phân biệt hoa thường).")
    public ResponseEntity<EnterpriseResponse> createEnterprise(
            @Valid @RequestBody EnterpriseRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        EnterpriseResponse created = adminEnterpriseService.createEnterprise(request, actorId, actorEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{enterpriseId}")
    @Operation(summary = "Đổi tên doanh nghiệp", description = "Cập nhật tên doanh nghiệp theo enterpriseId.")
    public ResponseEntity<EnterpriseResponse> renameEnterprise(
            @PathVariable Long enterpriseId,
            @Valid @RequestBody EnterpriseRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminEnterpriseService.renameEnterprise(enterpriseId, request, actorId, actorEmail));
    }

    @DeleteMapping("/{enterpriseId}")
    @Operation(summary = "Xóa doanh nghiệp", description = "Gỡ tài khoản thành viên và xóa doanh nghiệp. Trả về 409 nếu là doanh nghiệp mặc định (ID=1) hoặc còn repo khi force=false.")
    public ResponseEntity<Map<String, Object>> deleteEnterprise(
            @PathVariable Long enterpriseId,
            @RequestParam(defaultValue = "false") boolean force,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminEnterpriseService.deleteEnterprise(enterpriseId, force, actorId, actorEmail));
    }

    @PostMapping("/{enterpriseId}/users")
    @Operation(summary = "Phân nhiều tài khoản vào doanh nghiệp", description = "Gán hoặc chuyển danh sách userIds vào doanh nghiệp này.")
    public ResponseEntity<List<AdminUserResponse>> assignUsers(
            @PathVariable Long enterpriseId,
            @RequestBody AssignUsersToEnterpriseRequest request,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        List<Long> userIds = request != null ? request.getUserIds() : List.of();
        return ResponseEntity.ok(adminEnterpriseService.assignUsersToEnterprise(enterpriseId, userIds, actorId, actorEmail));
    }

    @DeleteMapping("/{enterpriseId}/users/{userId}")
    @Operation(summary = "Gỡ một tài khoản khỏi doanh nghiệp", description = "Gỡ userId khỏi doanh nghiệp (đưa về trạng thái chưa phân doanh nghiệp).")
    public ResponseEntity<AdminUserResponse> removeUser(
            @PathVariable Long enterpriseId,
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        return ResponseEntity.ok(adminEnterpriseService.removeUserFromEnterprise(enterpriseId, userId, actorId, actorEmail));
    }
}
