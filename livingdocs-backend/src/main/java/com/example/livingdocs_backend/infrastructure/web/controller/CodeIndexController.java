package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.code.EntityDocRegenerateRequestDto;
import com.example.livingdocs_backend.application.dto.code.EntityDocRegenerateResponseDto;
import com.example.livingdocs_backend.application.service.CodeIndexService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller cung cấp API Tạo lại tài liệu cục bộ cho một thực thể mã nguồn cụ thể
 * từ Cây mã nguồn (/cay-ma-nguon), chỉ cập nhật mục tương ứng và tạo phiên bản nháp (DRAFT).
 */
@RestController
@RequestMapping("/api/v1/code-entities")
@RequiredArgsConstructor
@Tag(name = "Code Entities & Localized Doc Regeneration", description = "API tạo lại tài liệu cục bộ cho từng thực thể mã nguồn (Class / Method) từ Cây mã nguồn")
public class CodeIndexController {

    private final CodeIndexService codeIndexService;

    @PostMapping("/{entityId}/regenerate-doc")
    @Operation(
            summary = "Tạo lại tài liệu cho một thực thể mã nguồn theo entityId",
            description = "Bóc tách lại cú pháp AST mới nhất của phương thức/lớp được chọn, gọi AI tạo lại riêng mục tài liệu của thực thể đó và lưu thành phiên bản nháp (DRAFT) mới mà không ảnh hưởng tới các mục đã duyệt khác."
    )
    public ResponseEntity<EntityDocRegenerateResponseDto> regenerateDocByEntityId(
            @PathVariable("entityId") Long entityId,
            @RequestBody(required = false) EntityDocRegenerateRequestDto request) {
        EntityDocRegenerateResponseDto response = codeIndexService.regenerateEntityDoc(entityId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/regenerate-doc")
    @Operation(
            summary = "Tạo lại tài liệu cho một thực thể mã nguồn từ Cây mã nguồn",
            description = "Hỗ trợ tạo lại tài liệu cục bộ cho thực thể mã nguồn theo entityId hoặc theo thông tin AST (repositoryId, filePath, className, methodName, signature) gửi từ Cây mã nguồn."
    )
    public ResponseEntity<EntityDocRegenerateResponseDto> regenerateDoc(
            @RequestBody EntityDocRegenerateRequestDto request) {
        EntityDocRegenerateResponseDto response = codeIndexService.regenerateEntityDoc(request);
        return ResponseEntity.ok(response);
    }
}
