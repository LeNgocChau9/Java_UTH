package com.example.livingdocs_backend.infrastructure.web.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/rbac-demo")
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "RBAC Control Demo", description = "Các API kiểm tra phân quyền RBAC cho 5 vai trò hệ thống")
public class RbacDemoController {

    @GetMapping("/admin-only")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Khu vực Quản trị viên (Chỉ ADMIN)", description = "Yêu cầu vai trò ROLE_ADMIN. DEVELOPER hoặc vai trò khác sẽ nhận mã 403 Forbidden.")
    public ResponseEntity<Map<String, Object>> getAdminArea(Principal principal) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Chào mừng ADMIN! Bạn có quyền quản trị toàn bộ hệ thống.");
        response.put("user", principal.getName());
        response.put("access", "GRANTED_ADMIN");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/techlead-only")
    @PreAuthorize("hasRole('TECH_LEAD') or hasRole('ADMIN')")
    @Operation(summary = "Khu vực Trưởng nhóm kỹ thuật (TECH_LEAD, ADMIN)", description = "Yêu cầu vai trò ROLE_TECH_LEAD hoặc ROLE_ADMIN.")
    public ResponseEntity<Map<String, Object>> getTechLeadArea(Principal principal) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Khu vực duyệt kiến trúc dành cho Tech Lead và Admin.");
        response.put("user", principal.getName());
        response.put("access", "GRANTED_TECH_LEAD");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/manager-only")
    @PreAuthorize("hasRole('MANAGER') or hasRole('ADMIN')")
    @Operation(summary = "Khu vực Quản lý dự án (MANAGER, ADMIN)", description = "Yêu cầu vai trò ROLE_MANAGER hoặc ROLE_ADMIN.")
    public ResponseEntity<Map<String, Object>> getManagerArea(Principal principal) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Khu vực phê duyệt tài liệu dành cho Quản lý dự án và Admin.");
        response.put("user", principal.getName());
        response.put("access", "GRANTED_MANAGER");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/staff-only")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    @Operation(summary = "Khu vực Kiểm thử & Rà soát (STAFF, ADMIN)", description = "Yêu cầu vai trò ROLE_STAFF hoặc ROLE_ADMIN.")
    public ResponseEntity<Map<String, Object>> getStaffArea(Principal principal) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Khu vực rà soát chất lượng dành cho Staff và Admin.");
        response.put("user", principal.getName());
        response.put("access", "GRANTED_STAFF");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/developer-only")
    @PreAuthorize("hasRole('DEVELOPER') or hasRole('ADMIN')")
    @Operation(summary = "Khu vực Lập trình viên (DEVELOPER, ADMIN)", description = "Yêu cầu vai trò ROLE_DEVELOPER hoặc ROLE_ADMIN.")
    public ResponseEntity<Map<String, Object>> getDeveloperArea(Principal principal) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Khu vực lập trình và đồng bộ mã nguồn của Developer.");
        response.put("user", principal.getName());
        response.put("access", "GRANTED_DEVELOPER");
        return ResponseEntity.ok(response);
    }
}
