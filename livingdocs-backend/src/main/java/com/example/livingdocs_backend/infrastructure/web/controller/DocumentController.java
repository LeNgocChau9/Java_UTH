package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.dto.RegenerateEntityDocRequest;
import com.example.livingdocs_backend.application.dto.RegenerateEntityDocResponse;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;
import com.example.livingdocs_backend.application.port.AiDocumentationServicePort;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Document - Quản lý tài liệu & Phiên bản", description = "API CRUD tài liệu, tự động tạo phiên bản kèm chuỗi băm (hash chain) đảm bảo toàn vẹn lịch sử")
public class DocumentController {

    private final DocumentServicePort documentServicePort;
    private final AiDocumentationServicePort aiDocumentationServicePort;
    private final SpringDataDocCodeLinkRepository docCodeLinkRepository;
    private final SpringDataCodeEntityRepository codeEntityRepository;
    private final AuditServicePort auditServicePort;

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

    @PostMapping(value = "/import/docx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Nạp tài liệu từ file Word (.docx)", description = "Tải lên file Word, chuẩn hóa sang Markdown, tự động tạo phiên bản v1 kèm Genesis Hash và lập chỉ mục doc_code_links.")
    public ResponseEntity<DocumentResponse> importDocx(
            @RequestParam("file") MultipartFile file,
            @RequestParam("repoId") Long repoId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "targetPath", required = false) String targetPath,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        DocumentResponse response = documentServicePort.importDocxDocument(file, repoId, title, targetPath, actorId, actorRole);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/import/external")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Nạp tài liệu từ nền tảng ngoài (Google Docs, Confluence, Jira, Markdown)", description = "Nạp tài liệu thông qua MCP / URL từ Google Docs, Confluence hoặc Jira, tự động chuẩn hóa sang Markdown và liên kết mã nguồn.")
    public ResponseEntity<DocumentResponse> importExternal(
            @Valid @RequestBody ImportExternalDocRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        DocumentResponse response = documentServicePort.importExternalDocument(request, actorId, actorRole);
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

    @PostMapping("/{docId}/submit-review")
    @Operation(summary = "Gửi tài liệu để review", description = "Chuyển trạng thái tài liệu từ DRAFT sang UNDER_REVIEW_STAFF tuân theo máy trạng thái.")
    public ResponseEntity<DocumentResponse> submitForReview(
            @PathVariable Long docId,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        DocumentResponse response = documentServicePort.submitForReview(docId, actorId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{docId}/staff-review")
    @PreAuthorize("hasAnyRole('STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Staff đánh giá tài liệu (Duyệt cấp 1)", description = "Chỉ Staff hoặc Manager mới có quyền duyệt cấp 1 để chuyển tài liệu từ UNDER_REVIEW_STAFF sang UNDER_REVIEW_MANAGER hoặc REJECTED.")
    public ResponseEntity<DocumentResponse> processStaffReview(
            @PathVariable Long docId,
            @RequestBody(required = false) StaffReviewDecisionRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);
        DocumentResponse response = documentServicePort.processStaffReview(docId, request, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{docId}/manager-review")
    @PreAuthorize("hasAnyRole('MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Manager phê duyệt tài liệu (Duyệt cấp 2)", description = "Chỉ Manager mới có quyền duyệt cấp 2: Phê duyệt xuất bản (PUBLISHED + push GitHub commit), Trả lại Staff (UNDER_REVIEW_STAFF) hoặc Từ chối (REJECTED).")
    public ResponseEntity<DocumentResponse> processManagerReview(
            @PathVariable Long docId,
            @RequestBody(required = false) ManagerReviewDecisionRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);
        DocumentResponse response = documentServicePort.processManagerReview(docId, request, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{docId}/audit-trail")
    @Operation(summary = "Xem nhật ký lịch sử thay đổi (Audit trail)", description = "Lấy toàn bộ lịch sử các hành động thay đổi, gửi duyệt, nhận xét của Staff và phê duyệt của Manager đối với tài liệu.")
    public ResponseEntity<List<DocumentAuditLogResponse>> getDocumentAuditTrail(@PathVariable Long docId) {
        return ResponseEntity.ok(documentServicePort.getDocumentAuditLogs(docId));
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

    @PostMapping("/{docId}/rollback/{targetVersion}")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Khôi phục tài liệu về phiên bản chỉ định", description = "Khôi phục nội dung tài liệu về một phiên bản chỉ định trong quá khứ. Tự động tạo phiên bản mới tiếp theo để bảo toàn tính bất biến và toàn vẹn chuỗi băm lịch sử.")
    public ResponseEntity<RollbackResponse> rollbackToVersion(
            @PathVariable Long docId,
            @PathVariable Integer targetVersion,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        RollbackResponse response = documentServicePort.rollbackToVersion(
                docId, targetVersion, reason, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{docId}/rollback")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Khôi phục tài liệu về phiên bản chỉ định (qua Request Body)", description = "Khôi phục nội dung tài liệu với tham số chi tiết trong Request Body bao gồm số phiên bản mục tiêu (targetVersion) hoặc ID phiên bản (versionId), lý do khôi phục và vai trò thực hiện.")
    public ResponseEntity<RollbackResponse> rollbackWithBody(
            @PathVariable Long docId,
            @Valid @RequestBody RollbackDocumentRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = (request != null && request.getActorRole() != null && !request.getActorRole().isBlank())
                ? request.getActorRole() : extractRole(userPrincipal);

        RollbackResponse response;
        if (request != null && request.getVersionId() != null && request.getVersionId() > 0) {
            response = documentServicePort.rollbackByVersionId(
                    docId, request.getVersionId(), request.getReason(), actorId, actorRole);
        } else {
            Integer targetVer = request != null ? request.getTargetVersion() : null;
            response = documentServicePort.rollbackToVersion(
                    docId, targetVer, request != null ? request.getReason() : null, actorId, actorRole);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{docId}/rollback/version/{versionId}")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Khôi phục tài liệu theo ID bản ghi phiên bản (versionId)", description = "Hoàn tác nội dung tài liệu về bất kỳ bản ghi phiên bản nào được lưu trong bảng lịch sử thay đổi theo versionId.")
    public ResponseEntity<RollbackResponse> rollbackByVersionId(
            @PathVariable Long docId,
            @PathVariable Long versionId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        RollbackResponse response = documentServicePort.rollbackByVersionId(
                docId, versionId, reason, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/collection/{collectionId}/rollback")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Khôi phục hàng loạt toàn bộ Bộ sưu tập về phiên bản trước", description = "Khôi phục hàng loạt toàn bộ các tài liệu thuộc cùng một bộ sưu tập nhằm phục hồi nhanh chóng trạng thái an toàn trước khi xảy ra một đợt cập nhật tự động bị lỗi.")
    public ResponseEntity<com.example.livingdocs_backend.application.dto.CollectionRollbackResponse> rollbackCollectionFromDocs(
            @PathVariable Long collectionId,
            @RequestBody(required = false) com.example.livingdocs_backend.application.dto.CollectionRollbackRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);

        var response = documentServicePort.rollbackCollection(collectionId, request, actorId, actorRole);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{docId}/publish-to-github")
    @PreAuthorize("hasAnyRole('MANAGER','TECH_LEAD','ADMIN')")
    @Operation(summary = "Xuất bản tài liệu lên GitHub", description = "Khi Manager duyệt xuất bản, gọi GitHub Contents API (PUT /repos/{owner}/{repo}/contents/{path}) với token người dùng, tự động tạo commit chứa file Markdown vào repo và lưu commit hash, link commit vào bảng document_versions.")
    public ResponseEntity<PublishToGitHubResponse> publishToGitHub(
            @PathVariable Long docId,
            @Valid @RequestBody PublishToGitHubRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        PublishToGitHubResponse response = documentServicePort.publishToGitHub(docId, request, actorId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{docId}/changelogs")
    @Operation(summary = "Lấy danh sách nhật ký thay đổi của tài liệu", description = "Truy xuất danh sách changelogs được tự động ghi lại mỗi khi tài liệu được tạo mới, chỉnh sửa, duyệt hoặc khôi phục.")
    public ResponseEntity<List<ChangelogResponse>> getDocumentChangelogs(@PathVariable Long docId) {
        List<ChangelogResponse> changelogs = documentServicePort.getDocumentChangelogs(docId);
        return ResponseEntity.ok(changelogs);
    }

    private String extractRole(UserPrincipal userPrincipal) {
        if (userPrincipal == null || userPrincipal.getAuthorities() == null || userPrincipal.getAuthorities().isEmpty()) {
            return "DEV";
        }
        String auth = userPrincipal.getAuthorities().iterator().next().getAuthority();
        return auth.startsWith("ROLE_") ? auth.substring(5) : auth;
    }

    @PostMapping("/generate-ai")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    @Operation(
            summary = "Điều phối sinh tài liệu AI theo 3 phạm vi (FILE, PACKAGE, REPOSITORY)",
            description = "Hỗ trợ 3 phạm vi (FILE, PACKAGE, REPOSITORY): lấy mã nguồn/AST, gọi FastAPI (/v1/docs/generate), lưu vào bảng documents & document_versions (trạng thái DRAFT) và lưu liên kết vào bảng doc_code_links."
    )
    public ResponseEntity<AiDocGenerateResponseDto> generateAiDocumentation(
            @RequestBody AiDocGenerateRequestDto request,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);
        AiDocGenerateResponseDto response = aiDocumentationServicePort.generateDocumentation(request, actorId, actorRole);
        if (auditServicePort != null) {
            String docId = response != null && response.docId() != null ? response.docId().toString() : null;
            auditServicePort.recordSecurityAction(actorId, AuditAction.AI_DOCUMENT_GENERATED, "DOCUMENT", docId,
                    "Sinh tài liệu AI. Phạm vi: " + (request != null ? request.scope() : ""));
        }
        return ResponseEntity.ok(response);
    }


    @GetMapping("/{docId}/code-links")
    @Operation(summary = "Lấy danh sách bằng chứng xác thực Grounding (doc_code_links) của tài liệu",
               description = "Trả về danh sách các tệp nguồn, lớp, hàm và khoảng dòng code được liên kết với tài liệu này.")
    public ResponseEntity<List<com.example.livingdocs_backend.application.dto.GroundingEvidenceItem>> getDocumentCodeLinks(
            @PathVariable Long docId) {
        if (docCodeLinkRepository == null) {
            return ResponseEntity.ok(List.of());
        }
        List<DocCodeLinkEntity> links = docCodeLinkRepository.findByDocumentId(docId);
        List<com.example.livingdocs_backend.application.dto.GroundingEvidenceItem> result = new java.util.ArrayList<>();
        for (DocCodeLinkEntity link : links) {
            Integer startLine = null;
            Integer endLine = null;
            String signature = null;
            String commitHash = null;

            if (link.getEntityId() != null && codeEntityRepository != null) {
                var entityOpt = codeEntityRepository.findById(link.getEntityId());
                if (entityOpt.isPresent()) {
                    var entity = entityOpt.get();
                    startLine = entity.getStartLine();
                    endLine = entity.getEndLine();
                    signature = entity.getSignature();
                    commitHash = entity.getCommitHash();
                }
            }

            result.add(com.example.livingdocs_backend.application.dto.GroundingEvidenceItem.builder()
                    .linkId(link.getLinkId())
                    .documentId(link.getDocumentId())
                    .entityId(link.getEntityId())
                    .filePath(link.getFilePath())
                    .className(link.getClassName())
                    .methodName(link.getMethodName())
                    .signature(signature)
                    .startLine(startLine)
                    .endLine(endLine)
                    .commitHash(commitHash)
                    .createdAt(link.getCreatedAt())
                    .build());
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{docId}/regenerate-entity")
    @Operation(
            summary = "Táº¡o láº¡i hoáº·c cáº­p nháº­t riÃªng tÃ i liá»‡u cá»§a má»™t thá»±c thá»ƒ mÃ£ nguá»“n (hÃ m/lá»›p)",
            description = "Cho phÃ©p láº­p trÃ¬nh viÃªn táº¡o láº¡i hoáº·c cáº­p nháº­t riÃªng tÃ i liá»‡u cá»§a má»™t hÃ m/lá»›p cá»¥ thá»ƒ khi hÃ m Ä‘Ã³ cÃ³ sá»­a Ä‘á»•i nhá» mÃ  khÃ´ng cáº§n sinh láº¡i toÃ n bá»™ file. Há»‡ thá»‘ng trÃ­ch xuáº¥t mÃ£ nguá»“n hÃ m/lá»›p, gá»i AI Engine (/v1/docs/rewrite-suggestion) viáº¿t láº¡i vÃ  cáº­p nháº­t trá»±c tiáº¿p vÃ o tÃ i liá»‡u tá»•ng thá»ƒ kÃ¨m phiÃªn báº£n má»›i."
    )
    public ResponseEntity<RegenerateEntityDocResponse> regenerateEntityDocumentation(
            @PathVariable Long docId,
            @RequestBody RegenerateEntityDocRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long actorId = userPrincipal != null ? userPrincipal.getUserId() : null;
        String actorRole = extractRole(userPrincipal);
        RegenerateEntityDocResponse response = documentServicePort.regenerateEntityDoc(docId, request, actorId, actorRole);
        return ResponseEntity.ok(response);
    }
}
