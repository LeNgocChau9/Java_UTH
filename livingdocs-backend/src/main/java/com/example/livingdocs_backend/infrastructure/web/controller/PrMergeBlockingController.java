package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.drift.PrMergeBlockingPolicyDto;
import com.example.livingdocs_backend.application.dto.github.GitHubCheckRunResultDto;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/settings/pr-blocking")
@RequiredArgsConstructor
@Tag(name = "PR Merge Blocking Settings (Issue #208)", description = "Cấu hình cơ chế Chặn Hợp nhất Pull Request khi tài liệu bị sai lệch nghiêm trọng")
public class PrMergeBlockingController {

    private final PrMergeBlockingServicePort prMergeBlockingService;

    @GetMapping
    @Operation(summary = "Lấy cấu hình chính sách chặn gộp Pull Request")
    public ResponseEntity<PrMergeBlockingPolicyDto> getPolicy() {
        return ResponseEntity.ok(prMergeBlockingService.getBlockingPolicy());
    }

    @PostMapping
    @Operation(summary = "Quản lý cập nhật cấu hình chính sách chặn gộp Pull Request (STRICT / WARN_ONLY)")
    public ResponseEntity<PrMergeBlockingPolicyDto> updatePolicy(
            @RequestBody PrMergeBlockingPolicyDto dto,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        String actorUsername = userPrincipal != null ? (userPrincipal.getEmail() != null ? userPrincipal.getEmail() : "ADMIN") : "ADMIN";
        PrMergeBlockingPolicyDto updated = prMergeBlockingService.updateBlockingPolicy(dto, actorId, actorUsername);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/evaluate/{repositoryId}/{prNumber}")
    @Operation(summary = "Kích hoạt đánh giá lại trạng thái Checks API và gửi kết quả lên GitHub PR")
    public ResponseEntity<GitHubCheckRunResultDto> evaluateCheck(
            @PathVariable Long repositoryId,
            @PathVariable int prNumber,
            @RequestParam(required = false) String headSha
    ) {
        GitHubCheckRunResultDto result = prMergeBlockingService.evaluateAndSendPrCheck(repositoryId, prNumber, headSha);
        return ResponseEntity.ok(result);
    }
}

