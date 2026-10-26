package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.AdminCreateUserRequest;
import com.example.livingdocs_backend.application.dto.AdminUserResponse;
import com.example.livingdocs_backend.application.port.AdminUserServicePort;
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

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Admin - Quản trị người dùng", description = "API dành cho ADMIN: xem danh sách, tạo tài khoản mới, đổi vai trò, khóa/mở khóa tài khoản")
public class AdminUserController {

    private final AdminUserServicePort adminUserServicePort;

    @GetMapping
    @Operation(summary = "Danh sách người dùng", description = "Trả về toàn bộ người dùng kèm vai trò và trạng thái. Chỉ ADMIN.")
    public ResponseEntity<List<AdminUserResponse>> listUsers() {
        return ResponseEntity.ok(adminUserServicePort.listUsers());
    }

    @PostMapping
    @Operation(summary = "Tạo tài khoản người dùng mới", description = "Chỉ ADMIN mới có quyền tạo tài khoản trực tiếp và chỉ định vai trò ban đầu.")
    public ResponseEntity<AdminUserResponse> createUser(@Valid @RequestBody AdminCreateUserRequest request,
                                                        @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        String actorEmail = actor != null ? actor.getEmail() : "admin";
        AdminUserResponse response = adminUserServicePort.createUser(request, actorId, actorEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{userId}/role")
    @Operation(summary = "Đổi vai trò người dùng", description = "Cập nhật vai trò (DEVELOPER, STAFF, MANAGER, TECH_LEAD, ADMIN) cho người dùng.")
    public ResponseEntity<AdminUserResponse> changeRole(@PathVariable Long userId,
                                                        @RequestParam String role,
                                                        @AuthenticationPrincipal UserPrincipal actor) {
        return ResponseEntity.ok(adminUserServicePort.changeRole(
                userId, role, actor.getUserId(), actor.getEmail()));
    }

    @PutMapping("/{userId}/status")
    @Operation(summary = "Khóa / mở khóa tài khoản", description = "active=true -> mở khóa (ACTIVE); active=false -> khóa (LOCKED).")
    public ResponseEntity<AdminUserResponse> changeStatus(@PathVariable Long userId,
                                                          @RequestParam boolean active) {
        return ResponseEntity.ok(adminUserServicePort.changeStatus(userId, active));
    }
}
