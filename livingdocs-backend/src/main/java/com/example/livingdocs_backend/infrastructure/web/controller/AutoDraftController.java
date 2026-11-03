package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.drift.ApplySuggestionRequestDto;
import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Auto Draft on Drift (S4-10)", description = "Cơ chế tự động sinh bản nháp khi phát hiện Trôi dạt (Auto-Draft), áp dụng đề xuất AI và chuyển thành bản nháp chính thức")
public class AutoDraftController {

    private final AutoDraftServicePort autoDraftService;

    @PostMapping("/api/drift-alerts/{alertId}/auto-draft")
    @Operation(
            summary = "Tự động sinh bản nháp từ AI gợi ý khi phát hiện Drift (Task S4-10)",
            description = "Gọi AI Engine (/v1/docs/rewrite-suggestion) viết lại các phần bị ảnh hưởng, tạo 1 bản ghi mới trong document_versions ở trạng thái PENDING_REVIEW với actor_role là AI_AGENT và đẩy vào hàng đợi xem xét của nhân viên."
    )
    public ResponseEntity<AutoDraftOnDriftResponse> generateAutoDraft(
            @PathVariable Long alertId,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        AutoDraftOnDriftResponse response = autoDraftService.generateDraftFromAlert(alertId, actor);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/auto-draft/apply-suggestion")
    @Operation(
            summary = "Chuyển đề xuất AI thành bản nháp chính thức",
            description = "Đầu ra nghiệp vụ: Nhận request chuyển đề xuất viết lại từ AI thành bản nháp chính thức (PENDING_REVIEW), ghi rõ tác nhân AI_AGENT và gửi thông báo đến hàng đợi xem xét của nhân viên."
    )
    public ResponseEntity<AutoDraftOnDriftResponse> applySuggestion(
            @Valid @RequestBody ApplySuggestionRequestDto request,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        AutoDraftOnDriftResponse response = autoDraftService.applySuggestion(request, actor);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/drift-alerts/{alertId}/accept-draft")
    @Operation(
            summary = "Chấp nhận bản nháp chỉ trong 1 click",
            description = "Duyệt bản nháp do AI sinh, cập nhật tài liệu sang APPROVED và đánh dấu cảnh báo drift là RESOLVED."
    )
    public ResponseEntity<AutoDraftOnDriftResponse> acceptAutoDraft(
            @PathVariable Long alertId,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        AutoDraftOnDriftResponse response = autoDraftService.acceptDraft(alertId, actor);
        return ResponseEntity.ok(response);
    }
}
