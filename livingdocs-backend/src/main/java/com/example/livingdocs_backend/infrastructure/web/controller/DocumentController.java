package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Document - Quản lý tài liệu & Phiên bản", description = "API CRUD tài liệu, tự động tạo phiên bản kèm chuỗi băm (hash chain) đảm bảo toàn vẹn lịch sử")
public class DocumentController {

    private final DocumentServicePort documentServicePort;

    @PostMapping
    @Operation(summary = "Tạo tài liệu mới", description = "Tạo mới tài liệu và tự động tạo phiên bản v1 kèm chuỗi băm khởi tạo (Genesis Hash).")
    public ResponseEntity<DocumentResponse> createDocument(
            @Valid @RequestBody CreateDocumentRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        DocumentResponse response = documentServicePort.createDocument(request, actorId, actorRole);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{docId}")
    @Operation(summary = "Cập nhật tài liệu (tự tạo phiên bản mới)", description = "Cập nhật tài liệu và tự động sinh bản ghi phiên bản mới v(N+1) liên kết mã băm prev_hash với phiên bản v(N).")
    public ResponseEntity<DocumentResponse> updateDocument(
            @PathVariable Long docId,
            @Valid @RequestBody UpdateDocumentRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        DocumentResponse response = documentServicePort.updateDocument(docId, request, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{docId}")
    @Operation(summary = "Xem chi tiết tài liệu", description = "Lấy thông tin tài liệu kèm nội dung phiên bản mới nhất và danh sách các phiên bản trong lịch sử.")
    public ResponseEntity<DocumentDetailResponse> getDocument(@PathVariable Long docId) {
        return ResponseEntity.ok(documentServicePort.getDocumentById(docId));
    }

    @GetMapping
    @Operation(summary = "Danh sách tài liệu", description = "Lấy danh sách toàn bộ tài liệu, hỗ trợ lọc theo repoId hoặc collectionId.")
    public ResponseEntity<List<DocumentResponse>> listDocuments(
            @RequestParam(required = false) Long repoId,
            @RequestParam(required = false) Long collectionId) {
        return ResponseEntity.ok(documentServicePort.listDocuments(repoId, collectionId));
    }

    @DeleteMapping("/{docId}")
    @Operation(summary = "Xóa tài liệu", description = "Xóa tài liệu cùng toàn bộ lịch sử các phiên bản liên quan và ghi nhận audit log.")
    public ResponseEntity<Map<String, Object>> deleteDocument(
            @PathVariable Long docId,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        documentServicePort.deleteDocument(docId, actorId);

        return ResponseEntity.ok(Map.of(
                "status", HttpStatus.OK.value(),
                "message", "Đã xóa thành công tài liệu ID: " + docId
        ));
    }

    @GetMapping("/{docId}/versions")
    @Operation(summary = "Xem lịch sử tất cả các phiên bản", description = "Lấy danh sách các phiên bản đã lưu của tài liệu, sắp xếp từ mới nhất đến cũ nhất.")
    public ResponseEntity<List<DocumentVersionResponse>> getVersions(@PathVariable Long docId) {
        return ResponseEntity.ok(documentServicePort.getDocumentVersions(docId));
    }

    @GetMapping("/{docId}/versions/{versionNum}")
    @Operation(summary = "Xem chi tiết một phiên bản cụ thể", description = "Lấy thông tin chi tiết và nội dung của một phiên bản cụ thể theo số versionNum.")
    public ResponseEntity<DocumentVersionResponse> getVersion(
            @PathVariable Long docId,
            @PathVariable Integer versionNum) {
        return ResponseEntity.ok(documentServicePort.getDocumentVersion(docId, versionNum));
    }

    @GetMapping("/{docId}/verify-integrity")
    @Operation(summary = "Kiểm tra toàn vẹn chuỗi băm (Anti-Tamper Verification)", description = "Xác minh toàn bộ chuỗi băm SHA-256 từ v1 đến vN để đảm bảo không có phiên bản nào bị chỉnh sửa trái phép ngoài luồng.")
    public ResponseEntity<IntegrityCheckResponse> verifyIntegrity(@PathVariable Long docId) {
        return ResponseEntity.ok(documentServicePort.verifyIntegrity(docId));
    }

    private String extractRole(UserPrincipal userPrincipal) {
        if (userPrincipal == null || userPrincipal.getAuthorities() == null || userPrincipal.getAuthorities().isEmpty()) {
            return "DEV";
        }
        String auth = userPrincipal.getAuthorities().iterator().next().getAuthority();
        return auth.startsWith("ROLE_") ? auth.substring(5) : auth;
    }
}
