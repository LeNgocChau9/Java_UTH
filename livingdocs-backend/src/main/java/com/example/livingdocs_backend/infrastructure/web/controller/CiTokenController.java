package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.CiTokenResponse;
import com.example.livingdocs_backend.application.dto.CreateCiTokenRequest;
import com.example.livingdocs_backend.application.dto.CreatedCiTokenResponse;
import com.example.livingdocs_backend.application.port.CiTokenServicePort;
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
@RequestMapping("/api/ci/tokens")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "CI Tokens - Quản lý Token CI cho GitHub Action", description = "API dành riêng cho ADMIN: Tạo mới token bảo mật, xem danh sách và thu hồi token.")
public class CiTokenController {

    private final CiTokenServicePort ciTokenServicePort;

    @GetMapping
    @Operation(summary = "Lấy danh sách CI Token", description = "Trả về toàn bộ CI Token (chỉ hiển thị prefix, không lộ secret). Chỉ ADMIN.")
    public ResponseEntity<List<CiTokenResponse>> getAllTokens() {
        return ResponseEntity.ok(ciTokenServicePort.getAllTokens());
    }

    @GetMapping("/repo/{repositoryId}")
    @Operation(summary = "Lấy danh sách CI Token theo repository", description = "Trả về danh sách token liên kết với repository cụ thể.")
    public ResponseEntity<List<CiTokenResponse>> getTokensByRepository(@PathVariable Long repositoryId) {
        return ResponseEntity.ok(ciTokenServicePort.getTokensByRepository(repositoryId));
    }

    @PostMapping
    @Operation(summary = "Tạo mới CI Token", description = "Tạo token bí mật mới. CHÚ Ý: Chuỗi token đầy đủ chỉ trả về một lần duy nhất trong phản hồi này.")
    public ResponseEntity<CreatedCiTokenResponse> createToken(@Valid @RequestBody CreateCiTokenRequest request,
                                                              @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        CreatedCiTokenResponse response = ciTokenServicePort.createToken(request, actorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{tokenId}")
    @Operation(summary = "Thu hồi CI Token", description = "Vô hiệu hóa vĩnh viễn một CI Token.")
    public ResponseEntity<Map<String, Object>> revokeToken(@PathVariable Long tokenId,
                                                          @AuthenticationPrincipal UserPrincipal actor) {
        Long actorId = actor != null ? actor.getUserId() : null;
        ciTokenServicePort.revokeToken(tokenId, actorId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã thu hồi CI Token thành công",
                "tokenId", tokenId
        ));
    }
}
