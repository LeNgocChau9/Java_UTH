package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.ChangelogResponse;
import com.example.livingdocs_backend.application.dto.PageResponse;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@RestController
@RequestMapping("/api/changelogs")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Changelog - Nhật ký thay đổi tài liệu", description = "API lọc và phân trang lịch sử thay đổi tài liệu toàn hệ thống")
public class ChangelogController {

        private final ChangelogServicePort changelogServicePort;

        @GetMapping
        @Operation(summary = "Lọc Changelog toàn hệ thống có phân trang", description = "Truy xuất danh sách changelog toàn hệ thống, hỗ trợ phân trang và lọc theo: vai trò tác giả (AI, STAFF, MANAGER, DEV), repositoryId, và khoảng ngày (fromDate, toDate). Tối ưu query SQL với Index.")
        public ResponseEntity<PageResponse<ChangelogResponse>> getChangelogs(
                        @Parameter(description = "Vai trò tác giả thực hiện thay đổi: AI, STAFF, MANAGER, DEV") @RequestParam(required = false) String actorRole,

                        @Parameter(description = "ID repository chứa tài liệu") @RequestParam(required = false) Long repoId,

                        @Parameter(description = "Từ ngày (định dạng YYYY-MM-DD)") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,

                        @Parameter(description = "Đến ngày (định dạng YYYY-MM-DD)") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,

                        @Parameter(description = "Số thứ tự trang (bắt đầu từ 0)") @RequestParam(defaultValue = "0") int page,

                        @Parameter(description = "Số lượng bản ghi mỗi trang (mặc định 20, tối đa 100)") @RequestParam(defaultValue = "20") int size) {
                int safePage = Math.max(0, page);
                int safeSize = Math.min(Math.max(1, size), 100);

                Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

                Instant fromInstant = fromDate != null ? fromDate.atStartOfDay(ZoneId.systemDefault()).toInstant()
                                : null;
                Instant toInstant = toDate != null
                                ? toDate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().minusMillis(1)
                                : null;

                PageResponse<ChangelogResponse> response = changelogServicePort.getFilteredChangelogs(
                                actorRole,
                                repoId,
                                fromInstant,
                                toInstant,
                                pageable);

                return ResponseEntity.ok(response);
        }
}
