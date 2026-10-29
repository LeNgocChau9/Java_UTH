package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.drift.CiDriftScanRequest;
import com.example.livingdocs_backend.application.dto.drift.CiDriftScanResponse;
import com.example.livingdocs_backend.application.port.CiDriftScanServicePort;
import com.example.livingdocs_backend.application.port.CiTokenServicePort;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.DriftAlert;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Controller tiếp nhận kết quả quét trôi dạt tài liệu (Documentation Drift)
 * tự động từ GitHub Action Runner thông qua CI Token xác thực.
 */
@Slf4j
@RestController
@RequestMapping("/api/ci/drift-scan")
@RequiredArgsConstructor
@Tag(name = "CI / GitHub Action - Drift Scan", description = "API tiếp nhận kết quả phát hiện sai lệch tài liệu từ GitHub Action và xác thực CI Token")
public class CiDriftScanController {

    private final CiDriftScanServicePort ciDriftScanService;
    private final CiTokenServicePort ciTokenService;

    @PostMapping
    @Operation(
            summary = "Tiếp nhận kết quả quét Drift từ GitHub Action",
            description = "Endpoint dành cho GitHub Action Runner gửi báo cáo các hàm thay đổi và tài liệu bị trôi dạt. Xác thực bằng header 'X-CI-Token' hoặc 'Authorization: Bearer <token>'."
    )
    @Parameter(
            name = "X-CI-Token",
            in = ParameterIn.HEADER,
            description = "CI Token xác thực (tiền tố 'ld_ci_')",
            schema = @Schema(type = "string", example = "ld_ci_a1b2c3d4e5f6...")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tiếp nhận thành công", content = @Content(schema = @Schema(implementation = CiDriftScanResponse.class))),
            @ApiResponse(responseCode = "401", description = "CI Token không hợp lệ, hết hạn hoặc bị thu hồi"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu payload không hợp lệ")
    })
    public ResponseEntity<?> receiveDriftScan(
            @RequestHeader(value = "X-CI-Token", required = false) String headerCiToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody CiDriftScanRequest request
    ) {
        // 1. Trích xuất CI Token từ X-CI-Token hoặc Authorization: Bearer
        String rawToken = extractToken(headerCiToken, authHeader);
        if (rawToken == null || rawToken.isBlank()) {
            log.warn("[CI Drift Scan] Từ chối yêu cầu: Không tìm thấy CI Token trong header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "status", 401,
                    "error", "Unauthorized",
                    "message", "Yêu cầu CI Token hợp lệ (Cung cấp qua header X-CI-Token hoặc Authorization: Bearer <token>)"
            ));
        }

        // 2. Xác thực CI Token qua CiTokenServicePort
        Optional<CiToken> tokenOpt = ciTokenService.validateAndTouchToken(rawToken);
        if (tokenOpt.isEmpty()) {
            log.warn("[CI Drift Scan] Từ chối yêu cầu: CI Token không hợp lệ hoặc đã bị thu hồi/hết hạn");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "status", 401,
                    "error", "Unauthorized",
                    "message", "CI Token không hợp lệ, đã hết hạn hoặc bị thu hồi"
            ));
        }

        CiToken ciToken = tokenOpt.get();

        // 3. Kiểm tra tính tương thích giữa token và repoId (nếu token được gán đích danh repo)
        if (ciToken.getRepositoryId() != null && !ciToken.getRepositoryId().equals(request.getRepoId())) {
            log.warn("[CI Drift Scan] Token được cấp cho repoId={} nhưng request gửi repoId={}",
                    ciToken.getRepositoryId(), request.getRepoId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "status", 403,
                    "error", "Forbidden",
                    "message", "CI Token này chỉ có quyền ghi nhận cho Repository ID: " + ciToken.getRepositoryId()
            ));
        }

        // 4. Lưu dữ liệu vào bảng drift_alerts
        CiDriftScanResponse response = ciDriftScanService.processCiDriftScan(request, ciToken);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/repositories/{repoId}")
    @Operation(summary = "Lấy danh sách các cảnh báo trôi dạt theo Repository từ bảng drift_alerts")
    public ResponseEntity<List<DriftAlert>> getAlertsByRepo(@PathVariable Long repoId) {
        return ResponseEntity.ok(ciDriftScanService.getAlertsByRepo(repoId));
    }

    @GetMapping("/repositories/{repoId}/pull-requests/{prNumber}")
    @Operation(summary = "Lấy danh sách các cảnh báo trôi dạt theo PR từ bảng drift_alerts")
    public ResponseEntity<List<DriftAlert>> getAlertsByPr(
            @PathVariable Long repoId,
            @PathVariable Integer prNumber
    ) {
        return ResponseEntity.ok(ciDriftScanService.getAlertsByPr(repoId, prNumber));
    }

    private String extractToken(String xCiToken, String authHeader) {
        if (xCiToken != null && !xCiToken.isBlank()) {
            return xCiToken.trim();
        }
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return null;
    }
}

