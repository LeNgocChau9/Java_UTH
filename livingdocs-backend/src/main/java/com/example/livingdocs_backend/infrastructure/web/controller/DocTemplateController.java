package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.DocTemplateRequest;
import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest;
import com.example.livingdocs_backend.application.dto.TemplatePreviewResponse;
import com.example.livingdocs_backend.application.service.DocTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
@Tag(name = "Doc templates", description = "CRUD mẫu tài liệu: danh sách, chi tiết, tạo, sửa, xóa")
public class DocTemplateController {

    private final DocTemplateService docTemplateService;

    @GetMapping
    @Operation(summary = "Danh sách mẫu", description = "Trả về toàn bộ doc_templates, gồm các mẫu đã seed.")
    public ResponseEntity<List<DocTemplateResponse>> list() {
        return ResponseEntity.ok(docTemplateService.list());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết một mẫu", description = "Lấy mẫu theo id. Trả 404 nếu không có.")
    public ResponseEntity<DocTemplateResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(docTemplateService.getById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo mẫu", description = "Tạo mẫu mới. Trả 409 nếu type đã tồn tại.")
    public ResponseEntity<DocTemplateResponse> create(@Valid @RequestBody DocTemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(docTemplateService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật mẫu", description = "Sửa name, type, structureJson và isDefault.")
    public ResponseEntity<DocTemplateResponse> update(@PathVariable Long id,
                                                      @Valid @RequestBody DocTemplateRequest request) {
        return ResponseEntity.ok(docTemplateService.update(id, request));
    }

    @PostMapping("/{id}/preview")
    @Operation(summary = "Xem trước mẫu với dữ liệu giả",
            description = "Nhận class name và danh sách method, điền vào structure của template rồi trả Markdown.")
    public ResponseEntity<TemplatePreviewResponse> preview(@PathVariable Long id,
                                                           @Valid @RequestBody TemplatePreviewRequest request) {
        return ResponseEntity.ok(docTemplateService.preview(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa mẫu", description = "Xóa mẫu theo id. Trả 204 khi xóa xong.")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        docTemplateService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
