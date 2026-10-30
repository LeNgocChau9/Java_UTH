package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.github.CreateRepoRequest;
import com.example.livingdocs_backend.application.dto.github.RepoResponse;
import com.example.livingdocs_backend.application.dto.github.SyncRepoResponse;
import com.example.livingdocs_backend.application.port.RepositoryServicePort;
import com.example.livingdocs_backend.infrastructure.github.GitHubOAuthClient;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Controller cung cấp REST API quản lý kho lưu trữ GitHub và đồng bộ dữ liệu.
 */
@RestController
@RequestMapping("/api/repos")
@RequiredArgsConstructor
@Tag(name = "Repositories", description = "Quản lý kết nối Repo GitHub và đồng bộ PR, Commit")
public class RepositoryController {

    private final RepositoryServicePort repositoryService;
    private final GitHubOAuthClient gitHubOAuthClient;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final SpringDataRepositoryRepository repositoryRepository;

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
            @RequestParam(value = "workspaceId", required = false) Long workspaceId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long targetWorkspaceId = workspaceId != null ? workspaceId : 1L;
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : null;
        autoImportReposIfNeeded(targetWorkspaceId, userId);
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
    public ResponseEntity<List<com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity>> getPullRequests(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        autoSyncRepoIfNeverSynced(id, userPrincipal != null ? userPrincipal.getUserId() : 1L);
        return ResponseEntity.ok(repositoryService.getRepoPullRequests(id));
    }

    @GetMapping("/{id}/commits")
    @Operation(summary = "Lấy danh sách Commits đã lưu của Repository")
    public ResponseEntity<List<com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity>> getCommits(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        autoSyncRepoIfNeverSynced(id, userPrincipal != null ? userPrincipal.getUserId() : 1L);
        return ResponseEntity.ok(repositoryService.getRepoCommits(id));
    }

    @PostMapping("/connections/{connectionId}/verify")
    @Operation(summary = "Kiểm tra tính hợp lệ của GitHub Access Token và bắn cảnh báo nếu hết hạn/bị revoke")
    public ResponseEntity<com.example.livingdocs_backend.application.dto.github.GitHubConnectionStatusResponse> verifyConnection(
            @PathVariable("connectionId") Long connectionId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        return ResponseEntity.ok(repositoryService.verifyConnectionToken(connectionId, userId));
    }

    @PostMapping("/connections/verify-all")
    @Operation(summary = "Quét kiểm tra toàn bộ kết nối GitHub Token trong workspace và bắn cảnh báo")
    public ResponseEntity<List<com.example.livingdocs_backend.application.dto.github.GitHubConnectionStatusResponse>> verifyAllConnections(
            @RequestParam(value = "workspaceId", required = false) Long workspaceId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        Long userId = userPrincipal != null ? userPrincipal.getUserId() : 1L;
        return ResponseEntity.ok(repositoryService.verifyWorkspaceConnections(workspaceId, userId));
    }

    private void autoImportReposIfNeeded(Long workspaceId, Long userId) {
        try {
            if (userId != null) {
                Optional<GitHubConnectionEntity> userConnOpt =
                        gitHubConnectionRepository.findByWorkspaceIdAndUserId(workspaceId, userId);
                if (userConnOpt.isEmpty()) {
                    userConnOpt = gitHubConnectionRepository.findFirstByUserIdOrderByCreatedAtDesc(userId);
                }
                if (userConnOpt.isPresent()) {
                    GitHubConnectionEntity userConn = userConnOpt.get();
                    if (repositoryRepository.findByConnectionId(userConn.getConnectionId()).isEmpty()) {
                        importReposFromConnection(workspaceId, userConn);
                    }
                }
            }

            if (repositoryRepository.findByWorkspaceId(workspaceId).isEmpty()) {
                for (GitHubConnectionEntity conn : gitHubConnectionRepository.findByWorkspaceId(workspaceId)) {
                    importReposFromConnection(workspaceId, conn);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void importReposFromConnection(Long workspaceId, GitHubConnectionEntity conn) {
        if (conn == null || conn.getConnectionId() == null) {
            return;
        }
        List<GitHubOAuthClient.GitHubRepoItem> ghRepos =
                gitHubOAuthClient.fetchUserRepositories(conn.getAccessTokenEncrypted(), conn.getGithubUsername());
        for (GitHubOAuthClient.GitHubRepoItem item : ghRepos) {
            if (!StringUtils.hasText(item.fullName())) {
                continue;
            }
            String fullName = item.fullName().trim();
            String name = StringUtils.hasText(item.name())
                    ? item.name().trim()
                    : (fullName.contains("/") ? fullName.substring(fullName.indexOf('/') + 1) : fullName);
            Long ghRepoId = item.id() != null ? item.id() : (long) Math.abs(fullName.hashCode());

            RepositoryEntity existing = repositoryRepository
                    .findByWorkspaceIdAndRepoFullName(workspaceId, fullName)
                    .orElseGet(() -> repositoryRepository
                            .findByWorkspaceIdAndGithubRepoId(workspaceId, ghRepoId)
                            .orElse(null));

            if (existing != null) {
                existing.setConnectionId(conn.getConnectionId());
                existing.setUpdatedAt(Instant.now());
                repositoryRepository.save(existing);
            } else {
                RepositoryEntity entity = RepositoryEntity.builder()
                        .workspaceId(workspaceId)
                        .connectionId(conn.getConnectionId())
                        .githubRepoId(ghRepoId)
                        .repoName(name)
                        .repoFullName(fullName)
                        .defaultBranch(StringUtils.hasText(item.defaultBranch()) ? item.defaultBranch().trim() : "main")
                        .cloneUrl(StringUtils.hasText(item.cloneUrl()) ? item.cloneUrl().trim() : "https://github.com/" + fullName + ".git")
                        .isActive(true)
                        .autoDocEnabled(true)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build();
                repositoryRepository.save(entity);
            }
        }
    }

    private void autoSyncRepoIfNeverSynced(Long repositoryId, Long userId) {
        try {
            Optional<RepositoryEntity> repoOpt = repositoryRepository.findById(repositoryId);
            if (repoOpt.isPresent() && repoOpt.get().getLastSyncedAt() == null) {
                repositoryService.syncRepository(repositoryId, null, userId);
            }
        } catch (Exception ignored) {
        }
    }
}
