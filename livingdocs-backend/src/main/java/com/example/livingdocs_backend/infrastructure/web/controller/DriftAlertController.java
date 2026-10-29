package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.DriftAlertActionRequest;
import com.example.livingdocs_backend.application.dto.DriftAlertResponse;
import com.example.livingdocs_backend.application.service.DriftAlertService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/drift-alerts")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Drift Alerts", description = "Xử lý cảnh báo sai lệch tài liệu và ghi audit log")
public class DriftAlertController {

    private final DriftAlertService driftAlertService;

    @PatchMapping("/{id}")
    @Operation(
            summary = "Cập nhật trạng thái cảnh báo drift",
            description = "IGNORE/DISMISS bỏ qua, RESOLVE đánh dấu đã giải quyết, ACCEPT chấp nhận sửa đổi, "
                    + "CHANGE_SEVERITY đổi mức độ. Chỉ Manager, Tech Lead hoặc Admin. Mỗi thao tác ghi audit log."
    )
    public ResponseEntity<DriftAlertResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody DriftAlertActionRequest request,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        return ResponseEntity.ok(driftAlertService.handle(id, request, actor));
    }
}
