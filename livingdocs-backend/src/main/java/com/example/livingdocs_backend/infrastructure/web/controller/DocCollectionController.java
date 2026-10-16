package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.DocCollectionRequest;
import com.example.livingdocs_backend.application.dto.DocCollectionResponse;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCollectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCollectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/collections")
@RequiredArgsConstructor
@Tag(name = "Collections - Bộ sưu tập tài liệu", description = "API quản lý các bộ sưu tập tài liệu trong hệ thống LivingDocs")
public class DocCollectionController {

    private final SpringDataDocCollectionRepository collectionRepository;
    private final SpringDataDocumentRepository documentRepository;

    @GetMapping
    @Operation(summary = "Danh sách bộ sưu tập", description = "Lấy danh sách toàn bộ các bộ sưu tập tài liệu kèm số lượng tài liệu bên trong.")
    public ResponseEntity<List<DocCollectionResponse>> listCollections() {
        List<DocCollectionEntity> entities = collectionRepository.findAll();
        List<DocCollectionResponse> responses = entities.stream().map(c -> {
            long count = documentRepository.findByCollectionId(c.getId() != null ? c.getId() : 0L).size();
            return DocCollectionResponse.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .description(c.getDescription())
                    .documentCount(count)
                    .createdAt(c.getCreatedAt())
                    .updatedAt(c.getUpdatedAt())
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết bộ sưu tập", description = "Lấy thông tin chi tiết một bộ sưu tập theo ID.")
    public ResponseEntity<DocCollectionResponse> getCollection(@PathVariable Long id) {
        DocCollectionEntity entity = collectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bộ sưu tập ID: " + id));

        long count = documentRepository.findByCollectionId(entity.getId() != null ? entity.getId() : 0L).size();
        return ResponseEntity.ok(DocCollectionResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .documentCount(count)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build());
    }

    @PostMapping
    @Operation(summary = "Tạo bộ sưu tập mới", description = "Tạo một bộ sưu tập tài liệu mới.")
    public ResponseEntity<DocCollectionResponse> createCollection(@Valid @RequestBody DocCollectionRequest request) {
        DocCollectionEntity entity = DocCollectionEntity.builder()
                .name(request.getName())
                .description(request.getDescription())
                .build();
        DocCollectionEntity saved = collectionRepository.save(entity);

        return ResponseEntity.status(HttpStatus.CREATED).body(DocCollectionResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .description(saved.getDescription())
                .documentCount(0L)
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt())
                .build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa bộ sưu tập", description = "Xóa một bộ sưu tập (các tài liệu bên trong sẽ được set collectionId = null).")
    public ResponseEntity<Map<String, Object>> deleteCollection(@PathVariable Long id) {
        if (!collectionRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "status", 404,
                    "message", "Không tìm thấy bộ sưu tập ID: " + id
            ));
        }

        // Set null collectionId cho các documents liên quan
        documentRepository.findByCollectionId(id).forEach(doc -> {
            doc.setCollectionId(null);
            documentRepository.save(doc);
        });

        collectionRepository.deleteById(id);
        return ResponseEntity.ok(Map.of(
                "status", HttpStatus.OK.value(),
                "message", "Đã xóa bộ sưu tập ID: " + id
        ));
    }
}
