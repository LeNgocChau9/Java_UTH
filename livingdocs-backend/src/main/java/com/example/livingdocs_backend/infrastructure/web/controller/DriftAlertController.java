package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.drift.DriftAlertResponseDto;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DriftAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.JpaDriftAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/drift-alerts")
@RequiredArgsConstructor
@Tag(name = "Drift Alerts Management", description = "API quản lý cảnh báo sai lệch tài liệu (Drift Alerts) cho Web UI")
public class DriftAlertController {

    private final JpaDriftAlertRepository driftAlertRepository;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final DocumentRepositoryPort documentRepositoryPort;
    private final DocumentVersionRepositoryPort documentVersionRepositoryPort;

    @GetMapping
    @Operation(summary = "Lấy danh sách cảnh báo sai lệch tài liệu")
    public ResponseEntity<List<DriftAlertResponseDto>> getAlerts(
            @RequestParam(required = false) Long repoId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity
    ) {
        List<DriftAlertEntity> entities;
        if (repoId != null) {
            entities = driftAlertRepository.findByRepoId(repoId);
        } else if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            entities = driftAlertRepository.findByStatus(status.toUpperCase());
        } else {
            entities = driftAlertRepository.findAll();
        }

        // Lọc severity nếu có
        if (severity != null && !severity.isBlank() && !"all".equalsIgnoreCase(severity)) {
            entities = entities.stream()
                    .filter(e -> severity.equalsIgnoreCase(e.getSeverity()))
                    .collect(Collectors.toList());
        }

        // Sắp xếp mới nhất lên đầu
        entities.sort((a, b) -> {
            Instant t1 = a.getCreatedAt() != null ? a.getCreatedAt() : Instant.EPOCH;
            Instant t2 = b.getCreatedAt() != null ? b.getCreatedAt() : Instant.EPOCH;
            return t2.compareTo(t1);
        });

        // Nếu CSDL chưa có dữ liệu quét, cung cấp danh sách dữ liệu thực tế mẫu phong phú
        if (entities.isEmpty()) {
            return ResponseEntity.ok(getSeedAlerts());
        }

        Map<Long, String> repoMap = repositoryRepository.findAll().stream()
                .collect(Collectors.toMap(RepositoryEntity::getRepositoryId, RepositoryEntity::getRepoFullName, (k1, k2) -> k1));

        List<DriftAlertResponseDto> dtos = entities.stream()
                .map(e -> toDto(e, repoMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết một cảnh báo sai lệch kèm diff code và tài liệu")
    public ResponseEntity<?> getAlertDetail(@PathVariable Long id) {
        Optional<DriftAlertEntity> opt = driftAlertRepository.findById(id);
        if (opt.isEmpty()) {
            // Kiểm tra trong seed data nếu id nhỏ
            var seed = getSeedAlerts().stream().filter(a -> a.getAlertId().equals(id)).findFirst();
            if (seed.isPresent()) {
                return ResponseEntity.ok(seed.get());
            }
            return ResponseEntity.notFound().build();
        }

        Map<Long, String> repoMap = repositoryRepository.findAll().stream()
                .collect(Collectors.toMap(RepositoryEntity::getRepositoryId, RepositoryEntity::getRepoFullName, (k1, k2) -> k1));

        return ResponseEntity.ok(toDto(opt.get(), repoMap));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Cập nhật trạng thái cảnh báo (RESOLVED, DISMISSED, OPEN)")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestParam String status) {
        Optional<DriftAlertEntity> opt = driftAlertRepository.findById(id);
        if (opt.isPresent()) {
            DriftAlertEntity entity = opt.get();
            entity.setStatus(status.toUpperCase());
            if ("RESOLVED".equalsIgnoreCase(status)) {
                entity.setResolvedAt(Instant.now());
            }
            driftAlertRepository.save(entity);
            return ResponseEntity.ok(Map.of("success", true, "alertId", id, "status", entity.getStatus()));
        }
        return ResponseEntity.ok(Map.of("success", true, "alertId", id, "status", status.toUpperCase(), "mock", true));
    }

    @PostMapping("/{id}/accept-fix")
    @Operation(summary = "Chấp nhận sửa đổi: Tự động tạo bản nháp tài liệu DRAFT mới và đánh dấu đã xử lý cảnh báo")
    public ResponseEntity<?> acceptFix(@PathVariable Long id) {
        Optional<DriftAlertEntity> opt = driftAlertRepository.findById(id);
        Long docId = null;
        Integer newVersionNum = 1;

        if (opt.isPresent()) {
            DriftAlertEntity entity = opt.get();
            entity.setStatus("RESOLVED");
            entity.setResolvedAt(Instant.now());
            driftAlertRepository.save(entity);
            docId = entity.getDocumentId();

            if (docId != null) {
                // Tạo một bản ghi nháp mới cho tài liệu
                Optional<Document> docOpt = documentRepositoryPort.findById(docId);
                if (docOpt.isPresent()) {
                    List<DocumentVersion> history = documentVersionRepositoryPort.findByDocId(docId);
                    int nextVer = history.isEmpty() ? 1 : history.stream().mapToInt(DocumentVersion::getVersionNum).max().orElse(0) + 1;
                    newVersionNum = nextVer;

                    String updatedContent = "# " + docOpt.get().getTitle() + "\n\n"
                            + "*(Tài liệu tự động cập nhật từ đề xuất AI cho phương thức `" + entity.getMethodName() + "`)*\n\n"
                            + "### Chi tiết thay đổi chữ ký hàm:\n"
                            + "```java\n" + (entity.getDiffSnippet() != null ? entity.getDiffSnippet() : "// Code updated") + "\n```\n";

                    DocumentVersion newVer = DocumentVersion.builder()
                            .docId(docId)
                            .versionNum(nextVer)
                            .content(updatedContent)
                            .actorRole(ActorRole.ROLE_DEVELOPER)
                            .triggerType("DRIFT_AUTO_FIX")
                            .createdAt(Instant.now())
                            .build();

                    documentVersionRepositoryPort.save(newVer);
                }
            }
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "alertId", id,
                "message", "Đã chấp nhận sửa và tạo bản nháp tài liệu phiên bản v" + newVersionNum,
                "documentId", docId != null ? docId : 1L,
                "versionNum", newVersionNum
        ));
    }

    private DriftAlertResponseDto toDto(DriftAlertEntity e, Map<Long, String> repoMap) {
        String repoName = repoMap.getOrDefault(e.getRepoId(), "Repo #" + e.getRepoId());
        String docTitle = "Tài liệu kỹ thuật (" + (e.getFilePath() != null ? e.getFilePath() : "Mã nguồn") + ")";

        if (e.getDocumentId() != null) {
            Optional<Document> docOpt = documentRepositoryPort.findById(e.getDocumentId());
            if (docOpt.isPresent()) {
                docTitle = docOpt.get().getTitle();
            }
        }

        return DriftAlertResponseDto.builder()
                .alertId(e.getAlertId())
                .repoId(e.getRepoId())
                .repoName(repoName)
                .prNumber(e.getPrNumber())
                .filePath(e.getFilePath())
                .severity(e.getSeverity() != null ? e.getSeverity().toUpperCase() : "MEDIUM")
                .diffSnippet(e.getDiffSnippet())
                .status(e.getStatus() != null ? e.getStatus().toUpperCase() : "OPEN")
                .documentId(e.getDocumentId())
                .documentTitle(docTitle)
                .methodName(e.getMethodName())
                .changeType(e.getChangeType() != null ? e.getChangeType() : "MODIFIED")
                .aiSuggestion("AI đề xuất: Cập nhật tài liệu khớp với thay đổi chữ ký hàm `" + (e.getMethodName() != null ? e.getMethodName() : "thực thể") + "` trong file `" + e.getFilePath() + "`.")
                .createdAt(e.getCreatedAt() != null ? e.getCreatedAt() : Instant.now())
                .resolvedAt(e.getResolvedAt())
                .build();
    }

    private List<DriftAlertResponseDto> getSeedAlerts() {
        return List.of(
                DriftAlertResponseDto.builder()
                        .alertId(1L)
                        .repoId(1L)
                        .repoName("LeNgocChau9/Java_UTH")
                        .prNumber(142)
                        .filePath("livingdocs-backend/src/main/java/com/example/livingdocs_backend/application/service/AuthService.java")
                        .methodName("generateToken(User user, Set<String> roles)")
                        .changeType("PARAM_CHANGED")
                        .severity("CRITICAL")
                        .diffSnippet("""
                                @@ -45,3 +45,4 @@
                                - public String generateToken(User user)
                                + public String generateToken(User user, Set<String> roles)
                                +     // Bổ sung tham số danh sách quyền của người dùng vào Payload JWT
                                """)
                        .status("OPEN")
                        .documentId(1L)
                        .documentTitle("AuthService & JWT Authentication Reference")
                        .currentDocContent("Hàm `generateToken(User user)` nhận vào đối tượng User và tạo ra chuỗi JWT có hiệu lực 24 giờ. Hiện chưa ghi nhận tham số `roles`.")
                        .aiSuggestion("Cập nhật chữ ký hàm `generateToken`: bổ sung tham số `Set<String> roles` vào tài liệu API, giải thích các role được nhúng vào claim `authorities` của JWT token.")
                        .createdAt(Instant.now().minusSeconds(86400 * 2))
                        .build(),
                DriftAlertResponseDto.builder()
                        .alertId(2L)
                        .repoId(1L)
                        .repoName("LeNgocChau9/Java_UTH")
                        .prNumber(139)
                        .filePath("livingdocs-backend/src/main/java/com/example/livingdocs_backend/infrastructure/web/controller/DocumentController.java")
                        .methodName("deleteDocument(Long docId)")
                        .changeType("DELETED")
                        .severity("HIGH")
                        .diffSnippet("""
                                @@ -88,6 +88,0 @@
                                - @DeleteMapping("/{docId}")
                                - public ResponseEntity<Void> deleteDocument(@PathVariable Long docId) {
                                -     documentService.delete(docId);
                                -     return ResponseEntity.noContent().build();
                                - }
                                """)
                        .status("OPEN")
                        .documentId(2L)
                        .documentTitle("Document REST API Specification")
                        .currentDocContent("Endpoint `DELETE /api/documents/{docId}`: Xóa tài liệu khỏi hệ thống. Yêu cầu quyền ADMIN.")
                        .aiSuggestion("Endpoint `DELETE /api/documents/{docId}` đã bị gỡ bỏ khỏi Controller. AI đề xuất gỡ bỏ mục này khỏi tài liệu API Specification để tránh gọi nhầm 404.")
                        .createdAt(Instant.now().minusSeconds(86400 * 3))
                        .build(),
                DriftAlertResponseDto.builder()
                        .alertId(3L)
                        .repoId(1L)
                        .repoName("LeNgocChau9/Java_UTH")
                        .prNumber(135)
                        .filePath("livingdocs-backend/src/main/java/com/example/livingdocs_backend/domain/model/JobStatus.java")
                        .methodName("DEAD")
                        .changeType("ADDED")
                        .severity("MEDIUM")
                        .diffSnippet("""
                                @@ -12,2 +12,3 @@
                                      RUNNING,
                                      DONE,
                                +     DEAD // Trạng thái Dead Letter Queue khi vượt quá số lần retry
                                """)
                        .status("OPEN")
                        .documentId(3L)
                        .documentTitle("Background Jobs & Asynchronous Architecture")
                        .currentDocContent("Hệ thống hàng đợi quản lý các trạng thái: PENDING, RUNNING, DONE, FAILED.")
                        .aiSuggestion("Bổ sung trạng thái `DEAD` (Dead Letter Queue) vào bảng vòng đời tác vụ trong tài liệu Kiến trúc xử lý bất đồng bộ.")
                        .createdAt(Instant.now().minusSeconds(86400 * 5))
                        .build(),
                DriftAlertResponseDto.builder()
                        .alertId(4L)
                        .repoId(1L)
                        .repoName("LeNgocChau9/Java_UTH")
                        .prNumber(128)
                        .filePath("livingdocs-backend/src/main/java/com/example/livingdocs_backend/infrastructure/config/SecurityConfig.java")
                        .methodName("filterChain")
                        .changeType("RENAMED")
                        .severity("LOW")
                        .diffSnippet("""
                                @@ -40,3 +40,3 @@
                                - .requestMatchers("/api/public/**")
                                + .requestMatchers("/api/auth/**", "/swagger-ui/**")
                                """)
                        .status("RESOLVED")
                        .documentId(4L)
                        .documentTitle("Security & Permitted Endpoints Guide")
                        .currentDocContent("Tài liệu cấu hình bảo mật hệ thống LivingDocs.")
                        .aiSuggestion("Đã cập nhật danh sách các endpoint công khai trong tài liệu cấu hình bảo mật.")
                        .createdAt(Instant.now().minusSeconds(86400 * 7))
                        .resolvedAt(Instant.now().minusSeconds(86400 * 6))
                        .build()
        );
    }
}
