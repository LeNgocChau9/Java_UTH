package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.integration.ExternalIntegrationDto;
import com.example.livingdocs_backend.application.dto.integration.TestExternalIntegrationRequest;
import com.example.livingdocs_backend.application.dto.integration.TestExternalIntegrationResponse;
import com.example.livingdocs_backend.application.dto.integration.UpdateExternalIntegrationRequest;
import com.example.livingdocs_backend.application.service.ExternalIntegrationService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/external-integrations")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "External Integrations", description = "Quản lý cấu hình tích hợp ngoài (Slack, Discord, Custom Webhook) và kiểm tra kết nối")
public class ExternalIntegrationController {

    private final ExternalIntegrationService integrationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Danh sách cấu hình tích hợp ngoài", description = "Trả về cấu hình Slack, Discord, Custom Webhook và các tích hợp mở rộng theo workspace.")
    public ResponseEntity<List<ExternalIntegrationDto>> listIntegrations(
            @RequestParam(value = "workspaceId", required = false) Long workspaceId) {
        return ResponseEntity.ok(integrationService.listIntegrations(workspaceId));
    }

    @GetMapping("/{provider}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xem chi tiết cấu hình tích hợp theo provider")
    public ResponseEntity<ExternalIntegrationDto> getIntegration(
            @PathVariable String provider,
            @RequestParam(value = "workspaceId", required = false) Long workspaceId) {
        return ResponseEntity.ok(integrationService.getIntegration(provider, workspaceId));
    }

    @PutMapping("/{provider}")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','MANAGER')")
    @Operation(summary = "Lưu hoặc cập nhật cấu hình tích hợp ngoài")
    public ResponseEntity<ExternalIntegrationDto> updateIntegration(
            @PathVariable String provider,
            @RequestBody UpdateExternalIntegrationRequest request,
            @RequestParam(value = "workspaceId", required = false) Long workspaceId,
            @AuthenticationPrincipal UserPrincipal principal) {
        Long actorId = principal != null ? principal.getUserId() : null;
        return ResponseEntity.ok(integrationService.upsertIntegration(provider, request, actorId, workspaceId));
    }

    @PostMapping("/test")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','MANAGER')")
    @Operation(summary = "Kiểm tra kết nối Webhook", description = "Gửi payload thử nghiệm thực tế tới Slack / Discord / Custom Webhook URL và trả về mã trạng thái HTTP.")
    public ResponseEntity<TestExternalIntegrationResponse> testConnection(
            @Valid @RequestBody TestExternalIntegrationRequest request,
            @RequestParam(value = "workspaceId", required = false) Long workspaceId) {
        return ResponseEntity.ok(integrationService.testConnection(request, workspaceId));
    }
}
