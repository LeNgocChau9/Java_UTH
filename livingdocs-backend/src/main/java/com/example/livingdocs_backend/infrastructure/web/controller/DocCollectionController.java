package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.CollectionDocumentsRequest;
import com.example.livingdocs_backend.application.dto.CollectionOwnerDto;
import com.example.livingdocs_backend.application.dto.CollectionRollbackRequest;
import com.example.livingdocs_backend.application.dto.CollectionRollbackResponse;
import com.example.livingdocs_backend.application.dto.DocCollectionRequest;
import com.example.livingdocs_backend.application.dto.DocCollectionResponse;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCollectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCollectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/collections")
@Tag(name = "Collections - Bộ sưu tập tài liệu", description = "API quản lý các bộ sưu tập tài liệu và phân quyền chủ sở hữu trong hệ thống LivingDocs")
public class DocCollectionController {

    private final SpringDataDocCollectionRepository collectionRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final DocumentServicePort documentServicePort;
    private final UserRepositoryPort userRepositoryPort;

    @Autowired
    public DocCollectionController(
            SpringDataDocCollectionRepository collectionRepository,
            SpringDataDocumentRepository documentRepository,
            DocumentServicePort documentServicePort,
            @Autowired(required = false) UserRepositoryPort userRepositoryPort) {
        this.collectionRepository = collectionRepository;
        this.documentRepository = documentRepository;
        this.documentServicePort = documentServicePort;
        this.userRepositoryPort = userRepositoryPort;
    }

    public DocCollectionController(
            SpringDataDocCollectionRepository collectionRepository,
            SpringDataDocumentRepository documentRepository,
            DocumentServicePort documentServicePort) {
        this(collectionRepository, documentRepository, documentServicePort, null);
    }

    @GetMapping
    @Operation(summary = "Danh sách bộ sưu tập", description = "Lấy danh sách toàn bộ các bộ sưu tập tài liệu kèm thông tin người phụ trách (Owner) và số lượng tài liệu bên trong.")
    public ResponseEntity<List<DocCollectionResponse>> listCollections() {
        List<DocCollectionEntity> entities = collectionRepository.findAll();
        List<DocCollectionResponse> responses = entities.stream()
                .map(this::toCollectionResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/owners")
    @Operation(summary = "Danh sách nhân sự phụ trách (Tech Lead / Developer)", description = "Lấy danh sách các Tech Lead và Developer đang hoạt động để gán làm chủ sở hữu (Owner) cho bộ sưu tập tài liệu.")
    public ResponseEntity<List<CollectionOwnerDto>> listCollectionOwners() {
        if (userRepositoryPort == null) {
            return ResponseEntity.ok(List.of());
        }
        List<User> allUsers = userRepositoryPort.findAll();
        List<CollectionOwnerDto> owners = allUsers.stream()
                .filter(u -> u.getStatus() == null || "ACTIVE".equalsIgnoreCase(u.getStatus()))
                .map(u -> {
                    String role = resolvePrimaryRole(u.getRoles());
                    return CollectionOwnerDto.builder()
                            .userId(u.getUserId())
                            .fullName(u.getFullName())
                            .email(u.getEmail())
                            .role(role)
                            .roleLabel(toRoleLabel(role))
                            .avatarUrl(u.getAvatarUrl())
                            .build();
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(owners);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết bộ sưu tập", description = "Lấy thông tin chi tiết một bộ sưu tập theo ID.")
    public ResponseEntity<DocCollectionResponse> getCollection(@PathVariable Long id) {
        DocCollectionEntity entity = collectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bộ sưu tập ID: " + id));

        return ResponseEntity.ok(toCollectionResponse(entity));
    }

    @PostMapping
    @Operation(summary = "Tạo bộ sưu tập mới", description = "Tạo một bộ sưu tập tài liệu mới theo phân hệ nghiệp vụ và gán người phụ trách chính (Owner).")
    public ResponseEntity<DocCollectionResponse> createCollection(@Valid @RequestBody DocCollectionRequest request) {
        DocCollectionEntity entity = DocCollectionEntity.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .moduleTag(request.getModuleTag() != null && !request.getModuleTag().isBlank() ? request.getModuleTag().trim() : null)
                .build();
        applyOwner(entity, request);

        DocCollectionEntity saved = collectionRepository.save(entity);

        if (request.getDocumentIds() != null && !request.getDocumentIds().isEmpty() && saved.getId() != null) {
            syncCollectionDocuments(saved.getId(), request.getDocumentIds(), false);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(toCollectionResponse(saved));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật bộ sưu tập & chuyển giao quyền sở hữu", description = "Chỉnh sửa tên, mô tả, phân hệ nghiệp vụ, thay đổi người phụ trách chính (Owner) hoặc đồng bộ danh sách tài liệu của bộ sưu tập.")
    public ResponseEntity<DocCollectionResponse> updateCollection(
            @PathVariable Long id,
            @Valid @RequestBody DocCollectionRequest request) {
        DocCollectionEntity entity = collectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bộ sưu tập ID: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            entity.setName(request.getName().trim());
        }
        entity.setDescription(request.getDescription());
        entity.setModuleTag(request.getModuleTag() != null && !request.getModuleTag().isBlank()
                ? request.getModuleTag().trim()
                : null);

        applyOwner(entity, request);

        DocCollectionEntity saved = collectionRepository.save(entity);

        if (request.getDocumentIds() != null) {
            syncCollectionDocuments(id, request.getDocumentIds(), true);
        }

        return ResponseEntity.ok(toCollectionResponse(saved));
    }

    @PostMapping("/{id}/documents")
    @Operation(summary = "Gán tài liệu vào bộ sưu tập", description = "Gán hàng loạt hoặc đồng bộ danh sách tài liệu thuộc về một bộ sưu tập.")
    public ResponseEntity<DocCollectionResponse> assignDocumentsToCollection(
            @PathVariable Long id,
            @RequestBody CollectionDocumentsRequest request) {
        DocCollectionEntity entity = collectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bộ sưu tập ID: " + id));

        List<Long> docIds = request != null && request.getDocumentIds() != null ? request.getDocumentIds() : List.of();
        boolean replaceAll = request != null && Boolean.TRUE.equals(request.getReplaceAll());
        syncCollectionDocuments(id, docIds, replaceAll);

        return ResponseEntity.ok(toCollectionResponse(entity));
    }

    @DeleteMapping("/{id}/documents/{docId}")
    @Operation(summary = "Gỡ tài liệu khỏi bộ sưu tập", description = "Gỡ một tài liệu ra khỏi bộ sưu tập (chuyển collectionId của tài liệu về null).")
    public ResponseEntity<DocCollectionResponse> removeDocumentFromCollection(
            @PathVariable Long id,
            @PathVariable Long docId) {
        DocCollectionEntity entity = collectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bộ sưu tập ID: " + id));

        documentRepository.findById(docId).ifPresent(doc -> {
            if (Objects.equals(doc.getCollectionId(), id)) {
                doc.setCollectionId(null);
                documentRepository.save(doc);
            }
        });

        return ResponseEntity.ok(toCollectionResponse(entity));
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

    @PostMapping("/{id}/rollback")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(
            summary = "Khôi phục hàng loạt toàn bộ Bộ sưu tập về phiên bản trước",
            description = "Hoàn tác hàng loạt cho toàn bộ các tài liệu thuộc cùng một bộ sưu tập nhằm phục hồi nhanh chóng trạng thái an toàn trước khi xảy ra một đợt cập nhật tự động bị lỗi hoặc không đạt yêu cầu. Tự động ghi nhận dòng nhật ký kiểm toán về thao tác hoàn tác."
    )
    public ResponseEntity<CollectionRollbackResponse> rollbackCollection(
            @PathVariable Long id,
            @RequestBody(required = false) CollectionRollbackRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        CollectionRollbackResponse response = documentServicePort.rollbackCollection(id, request, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    private void applyOwner(DocCollectionEntity entity, DocCollectionRequest request) {
        if (request == null) {
            return;
        }
        if (request.getOwnerId() != null) {
            entity.setOwnerId(request.getOwnerId());
            User resolvedUser = userRepositoryPort != null
                    ? userRepositoryPort.findById(request.getOwnerId()).orElse(null)
                    : null;

            String ownerName = (request.getOwnerName() != null && !request.getOwnerName().isBlank())
                    ? request.getOwnerName().trim()
                    : (resolvedUser != null ? resolvedUser.getFullName() : null);
            String ownerEmail = (request.getOwnerEmail() != null && !request.getOwnerEmail().isBlank())
                    ? request.getOwnerEmail().trim()
                    : (resolvedUser != null ? resolvedUser.getEmail() : null);
            String ownerRole = (request.getOwnerRole() != null && !request.getOwnerRole().isBlank())
                    ? request.getOwnerRole().trim()
                    : (resolvedUser != null ? resolvePrimaryRole(resolvedUser.getRoles()) : "DEVELOPER");

            entity.setOwnerName(ownerName);
            entity.setOwnerEmail(ownerEmail);
            entity.setOwnerRole(ownerRole);
        } else if (request.getOwnerName() != null && !request.getOwnerName().isBlank()) {
            entity.setOwnerId(null);
            entity.setOwnerName(request.getOwnerName().trim());
            entity.setOwnerEmail(request.getOwnerEmail() != null && !request.getOwnerEmail().isBlank() ? request.getOwnerEmail().trim() : null);
            entity.setOwnerRole(request.getOwnerRole() != null && !request.getOwnerRole().isBlank() ? request.getOwnerRole().trim() : "DEVELOPER");
        } else {
            entity.setOwnerId(null);
            entity.setOwnerName(null);
            entity.setOwnerEmail(null);
            entity.setOwnerRole(null);
        }
    }

    private void syncCollectionDocuments(Long collectionId, List<Long> targetDocIds, boolean replaceAll) {
        Set<Long> targetSet = targetDocIds != null ? new HashSet<>(targetDocIds) : Set.of();

        if (replaceAll) {
            List<DocumentEntity> currentDocs = documentRepository.findByCollectionId(collectionId);
            for (DocumentEntity doc : currentDocs) {
                if (!targetSet.contains(doc.getDocId())) {
                    doc.setCollectionId(null);
                    documentRepository.save(doc);
                }
            }
        }

        for (Long docId : targetSet) {
            if (docId == null) continue;
            documentRepository.findById(docId).ifPresent(doc -> {
                if (!Objects.equals(doc.getCollectionId(), collectionId)) {
                    doc.setCollectionId(collectionId);
                    documentRepository.save(doc);
                }
            });
        }
    }

    private DocCollectionResponse toCollectionResponse(DocCollectionEntity c) {
        List<DocumentEntity> docs = (c.getId() != null && documentRepository != null)
                ? documentRepository.findByCollectionId(c.getId())
                : List.of();
        List<Long> docIds = docs != null
                ? docs.stream().map(DocumentEntity::getDocId).filter(Objects::nonNull).collect(Collectors.toList())
                : new ArrayList<>();

        String ownerName = c.getOwnerName();
        String ownerEmail = c.getOwnerEmail();
        String ownerRole = c.getOwnerRole();

        if (c.getOwnerId() != null && (ownerName == null || ownerEmail == null || ownerRole == null) && userRepositoryPort != null) {
            User owner = userRepositoryPort.findById(c.getOwnerId()).orElse(null);
            if (owner != null) {
                if (ownerName == null) ownerName = owner.getFullName();
                if (ownerEmail == null) ownerEmail = owner.getEmail();
                if (ownerRole == null) ownerRole = resolvePrimaryRole(owner.getRoles());
            }
        }

        return DocCollectionResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .description(c.getDescription())
                .moduleTag(c.getModuleTag())
                .ownerId(c.getOwnerId())
                .ownerName(ownerName)
                .ownerEmail(ownerEmail)
                .ownerRole(ownerRole)
                .documentCount((long) docIds.size())
                .documentIds(docIds)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private String resolvePrimaryRole(Set<RoleType> roles) {
        if (roles == null || roles.isEmpty()) {
            return "DEVELOPER";
        }
        if (roles.contains(RoleType.ROLE_TECH_LEAD)) return "TECH_LEAD";
        if (roles.contains(RoleType.ROLE_STAFF)) return "STAFF";
        if (roles.contains(RoleType.ROLE_MANAGER)) return "MANAGER";
        if (roles.contains(RoleType.ROLE_DEVELOPER)) return "DEVELOPER";
        if (roles.contains(RoleType.ROLE_ADMIN)) return "ADMIN";
        return roles.iterator().next().getRawName();
    }

    private String toRoleLabel(String role) {
        if (role == null) return "Lập trình viên (Developer)";
        return switch (role.toUpperCase()) {
            case "TECH_LEAD" -> "Trưởng nhóm kỹ thuật (Tech Lead)";
            case "STAFF" -> "Kỹ sư chính / Tech Lead (Staff)";
            case "MANAGER" -> "Quản lý kỹ thuật (Manager)";
            case "ADMIN" -> "Quản trị viên (Admin)";
            default -> "Lập trình viên (Developer)";
        };
    }

    private String extractRole(UserPrincipal userPrincipal) {
        if (userPrincipal == null || userPrincipal.getAuthorities() == null || userPrincipal.getAuthorities().isEmpty()) {
            return "MANAGER";
        }
        String auth = userPrincipal.getAuthorities().iterator().next().getAuthority();
        return auth.startsWith("ROLE_") ? auth.substring(5) : auth;
    }
}
