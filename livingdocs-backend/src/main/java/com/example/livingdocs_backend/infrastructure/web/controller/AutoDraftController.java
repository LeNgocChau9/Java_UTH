package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/drift-alerts")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Auto Draft on Drift (S4-10)", description = "Cơ chế tự động sinh bản nháp DRAFT khi phát hiện Drift và duyệt trong 1 click")
public class AutoDraftController {

    private final AutoDraftServicePort autoDraftService;

    @PostMapping("/{alertId}/auto-draft")
    @Operation(
            summary = "Tự động sinh bản nháp DRAFT từ AI gợi ý khi phát hiện Drift (Task S4-10)",
            description = "Gọi AI Engine viết lại các phần bị ảnh hưởng, tạo 1 bản ghi mới trong document_versions ở trạng thái DRAFT và liên kết vào cảnh báo drift."
    )
    public ResponseEntity<AutoDraftOnDriftResponse> generateAutoDraft(
            @PathVariable Long alertId,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        AutoDraftOnDriftResponse response = autoDraftService.generateDraftFromAlert(alertId, actor);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{alertId}/accept-draft")
    @Operation(
            summary = "Chấp nhận bản nháp DRAFT chỉ trong 1 click",
            description = "Duyệt bản nháp DRAFT do AI sinh, cập nhật tài liệu sang APPROVED và đánh dấu cảnh báo drift là RESOLVED."
    )
    public ResponseEntity<AutoDraftOnDriftResponse> acceptAutoDraft(
            @PathVariable Long alertId,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        AutoDraftOnDriftResponse response = autoDraftService.acceptDraft(alertId, actor);
        return ResponseEntity.ok(response);
    }
}

