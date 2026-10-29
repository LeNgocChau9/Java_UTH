package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ChangelogResponse;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/changelogs")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Changelog - Nhật ký thay đổi tài liệu", description = "API truy xuất lịch sử thay đổi tài liệu toàn hệ thống, hỗ trợ lọc theo Document và Actor Role (AI, DEV, STAFF, MANAGER)")
public class ChangelogController {

    private final ChangelogServicePort changelogServicePort;

    @GetMapping
    @Operation(summary = "Lấy danh sách nhật ký thay đổi toàn hệ thống", description = "Truy xuất danh sách changelog có lọc theo documentId hoặc actorRole.")
    public ResponseEntity<List<ChangelogResponse>> getChangelogs(
            @RequestParam(required = false) Long documentId,
            @RequestParam(required = false) String actorRole) {

        List<ChangelogResponse> changelogs = changelogServicePort.getChangelogs(documentId, actorRole);
        return ResponseEntity.ok(changelogs);
    }
}
