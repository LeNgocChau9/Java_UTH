package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.github.CreateRepoRequest;
import com.example.livingdocs_backend.application.dto.github.RepoResponse;
import com.example.livingdocs_backend.application.dto.github.SyncRepoResponse;
import com.example.livingdocs_backend.application.port.RepositoryServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller cung cấp REST API quản lý kho lưu trữ GitHub và đồng bộ dữ liệu.
 */
@RestController
@RequestMapping("/api/repos")
@RequiredArgsConstructor
@Tag(name = "Repositories", description = "Quản lý kết nối Repo GitHub và đồng bộ PR, Commit")
public class RepositoryController {

    private final RepositoryServicePort repositoryService;

    @PostMapping
    @Operation(summary = "Thêm kho lưu trữ GitHub vào Workspace")
    public ResponseEntity<RepoResponse> addRepository(
            @Valid @RequestBody CreateRepoRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        RepoResponse response = repositoryService.addRepository(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{id}/sync")
    @Operation(summary = "Đồng bộ PR và Commit từ GitHub về Database")
    public ResponseEntity<SyncRepoResponse> syncRepository(
            @PathVariable("id") Long id,
            @RequestParam(value = "token", required = false) String token,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        SyncRepoResponse response = repositoryService.syncRepository(id, token, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách các Repository trong Workspace")
    public ResponseEntity<List<RepoResponse>> listRepositories(
            @RequestParam(value = "workspaceId", required = false) Long workspaceId
    ) {
        List<RepoResponse> list = repositoryService.listRepositories(workspaceId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết một Repository theo ID")
    public ResponseEntity<RepoResponse> getRepository(@PathVariable("id") Long id) {
        RepoResponse repo = repositoryService.getRepository(id);
        return ResponseEntity.ok(repo);
    }

    @GetMapping("/{id}/pulls")
    @Operation(summary = "Lấy danh sách PR đã lưu của Repository")
    public ResponseEntity<List<com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity>> getPullRequests(@PathVariable("id") Long id) {
        return ResponseEntity.ok(repositoryService.getRepoPullRequests(id));
    }

    @GetMapping("/{id}/commits")
    @Operation(summary = "Lấy danh sách Commits đã lưu của Repository")
    public ResponseEntity<List<com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity>> getCommits(@PathVariable("id") Long id) {
        return ResponseEntity.ok(repositoryService.getRepoCommits(id));
    }
}

