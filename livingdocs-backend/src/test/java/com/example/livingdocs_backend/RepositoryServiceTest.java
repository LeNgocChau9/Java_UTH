package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.example.livingdocs_backend.application.dto.github.CreateRepoRequest;
import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.application.dto.github.RepoResponse;
import com.example.livingdocs_backend.application.dto.github.SyncRepoResponse;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.RepositoryServiceImpl;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCommitRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;

class RepositoryServiceTest {

        private SpringDataRepositoryRepository repositoryRepository;
        private SpringDataPullRequestRepository pullRequestRepository;
        private SpringDataCommitRepository commitRepository;
        private SpringDataGitHubConnectionRepository gitHubConnectionRepository;
        private GitHubClientPort gitHubClient;
        private AuditServicePort auditServicePort;

        private RepositoryServiceImpl repositoryService;

        @BeforeEach
        void setUp() {
                repositoryRepository = mock(SpringDataRepositoryRepository.class);
                pullRequestRepository = mock(SpringDataPullRequestRepository.class);
                commitRepository = mock(SpringDataCommitRepository.class);
                gitHubConnectionRepository = mock(SpringDataGitHubConnectionRepository.class);
                gitHubClient = mock(GitHubClientPort.class);
                auditServicePort = mock(AuditServicePort.class);

                repositoryService = new RepositoryServiceImpl(
                                repositoryRepository,
                                pullRequestRepository,
                                commitRepository,
                                gitHubConnectionRepository,
                                gitHubClient,
                                auditServicePort);
        }


        @Test
        @DisplayName("Thêm Repo: Lưu repo vào database và trả về RepoResponse")
        void shouldAddRepositorySuccessfully() {
                CreateRepoRequest request = CreateRepoRequest.builder()
                                .workspaceId(1L)
                                .repoFullName("LeNgocChau9/Java_UTH")
                                .defaultBranch("main")
                                .githubToken("ghp_test123")
                                .build();

                when(repositoryRepository.findByWorkspaceIdAndRepoFullName(1L, "LeNgocChau9/Java_UTH"))
                                .thenReturn(Optional.empty());

                when(gitHubConnectionRepository.findByWorkspaceIdAndUserId(1L, 10L))
                                .thenReturn(Optional.empty());

                GitHubConnectionEntity dummyConn = GitHubConnectionEntity.builder()
                                .connectionId(99L)
                                .workspaceId(1L)
                                .userId(10L)
                                .githubUsername("LeNgocChau9")
                                .accessTokenEncrypted("ghp_test123")
                                .build();
                when(gitHubConnectionRepository.save(any(GitHubConnectionEntity.class))).thenReturn(dummyConn);

                when(repositoryRepository.save(any(RepositoryEntity.class))).thenAnswer(invocation -> {
                        RepositoryEntity r = invocation.getArgument(0);
                        r.setRepositoryId(500L);
                        return r;
                });

                RepoResponse response = repositoryService.addRepository(request, 10L);

                assertNotNull(response);
                assertEquals(500L, response.repositoryId());
                assertEquals("LeNgocChau9/Java_UTH", response.repoFullName());
                assertEquals("Java_UTH", response.repoName());
                assertEquals(1L, response.workspaceId());
                verify(repositoryRepository).save(any(RepositoryEntity.class));
        }

        @Test
        @DisplayName("Sync Repo: Kéo danh sách PR và commit từ GitHubClient rồi lưu vào database")
        void shouldSyncPullRequestsAndCommitsSuccessfully() {
                Long repoId = 100L;
                RepositoryEntity repo = RepositoryEntity.builder()
                                .repositoryId(repoId)
                                .workspaceId(1L)
                                .connectionId(99L)
                                .repoFullName("owner/project")
                                .repoName("project")
                                .defaultBranch("main")
                                .build();

                when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(repo));

                // Mock GitHub PRs
                GitHubPullRequestDto pr1 = GitHubPullRequestDto.builder()
                                .id(111L)
                                .number(1)
                                .title("feat: S2-02 client")
                                .headBranch("feature/S2-02")
                                .baseBranch("main")
                                .state("OPEN")
                                .authorLogin("dev1")
                                .createdAt(Instant.now())
                                .build();
                when(gitHubClient.listPullRequests(any(), eq("owner"), eq("project"), eq("all")))
                                .thenReturn(List.of(pr1));

                // Mock GitHub Commits
                GitHubCommitDto commit1 = GitHubCommitDto.builder()
                                .sha("hash_abc")
                                .message("commit message")
                                .authorName("Dev 1")
                                .authorEmail("dev1@example.com")
                                .authorDate(Instant.now())
                                .build();
                when(gitHubClient.listCommits(any(), eq("owner"), eq("project"), eq("main"), eq(50)))
                                .thenReturn(List.of(commit1));

                when(pullRequestRepository.findByRepositoryIdAndPrNumber(repoId, 1)).thenReturn(Optional.empty());
                when(commitRepository.findByRepositoryIdAndCommitHash(repoId, "hash_abc")).thenReturn(Optional.empty());

                SyncRepoResponse syncResponse = repositoryService.syncRepository(repoId, "ghp_direct_token", 10L);

                assertNotNull(syncResponse);
                assertEquals(repoId, syncResponse.repositoryId());
                assertEquals(1, syncResponse.syncedPullRequestsCount());
                assertEquals(1, syncResponse.syncedCommitsCount());

                verify(pullRequestRepository, times(1)).save(any(PullRequestEntity.class));
                verify(commitRepository, times(1)).save(any(CommitEntity.class));
                verify(repositoryRepository).save(repo);
                assertNotNull(repo.getLastSyncedAt());
        }

        @Test
        @DisplayName("Kiểm tra Token: Token hợp lệ cập nhật status CONNECTED")
        void testVerifyConnectionToken_validToken() {
                Long connId = 100L;
                GitHubConnectionEntity conn = GitHubConnectionEntity.builder()
                                .connectionId(connId)
                                .workspaceId(1L)
                                .userId(10L)
                                .githubUsername("valid_dev")
                                .accessTokenEncrypted("ghp_valid_secret")
                                .status("CONNECTED")
                                .build();

                when(gitHubConnectionRepository.findById(connId)).thenReturn(Optional.of(conn));
                when(gitHubClient.validateToken("ghp_valid_secret")).thenReturn(
                                com.example.livingdocs_backend.application.dto.github.GitHubTokenValidationResult.builder()
                                                .valid(true)
                                                .status("CONNECTED")
                                                .githubUsername("valid_dev")
                                                .scopes("repo, read:user")
                                                .message("OK")
                                                .build());

                var result = repositoryService.verifyConnectionToken(connId, 10L);

                assertNotNull(result);
                assertTrue(result.isValid());
                assertEquals("CONNECTED", result.getStatus());
                assertNull(result.getWarningMessage());

                verify(gitHubConnectionRepository).save(conn);
                verifyNoInteractions(auditServicePort);
        }

        @Test
        @DisplayName("Kiểm tra Token: Token bị thu hồi (REVOKED) cập nhật status và ghi nhận AuditLog cảnh báo")
        void testVerifyConnectionToken_revokedToken() {
                Long connId = 101L;
                GitHubConnectionEntity conn = GitHubConnectionEntity.builder()
                                .connectionId(connId)
                                .workspaceId(1L)
                                .userId(10L)
                                .githubUsername("revoked_dev")
                                .accessTokenEncrypted("ghp_revoked_token")
                                .status("CONNECTED")
                                .build();

                when(gitHubConnectionRepository.findById(connId)).thenReturn(Optional.of(conn));
                when(gitHubClient.validateToken("ghp_revoked_token")).thenReturn(
                                com.example.livingdocs_backend.application.dto.github.GitHubTokenValidationResult.builder()
                                                .valid(false)
                                                .status("REVOKED")
                                                .message("Token đã bị revoke bởi người dùng")
                                                .build());

                var result = repositoryService.verifyConnectionToken(connId, 10L);

                assertNotNull(result);
                assertFalse(result.isValid());
                assertEquals("REVOKED", result.getStatus());
                assertNotNull(result.getWarningMessage());
                assertTrue(result.getWarningMessage().contains("CẢNH BÁO"));

                verify(gitHubConnectionRepository).save(conn);
                verify(auditServicePort).recordSecurityAction(eq(10L), eq(AuditAction.GITHUB_TOKEN_REVOKED),
                                eq("GITHUB_CONNECTION"), eq("101"), anyString());
        }

        @Test
        @DisplayName("Kiểm tra Token: Token hết hạn (EXPIRED) cập nhật status và ghi nhận AuditLog cảnh báo")
        void testVerifyConnectionToken_expiredToken() {
                Long connId = 102L;
                GitHubConnectionEntity conn = GitHubConnectionEntity.builder()
                                .connectionId(connId)
                                .workspaceId(1L)
                                .userId(10L)
                                .githubUsername("expired_dev")
                                .accessTokenEncrypted("ghp_expired_token")
                                .tokenExpiresAt(Instant.now().minusSeconds(3600)) // Hết hạn 1 tiếng trước
                                .status("CONNECTED")
                                .build();

                when(gitHubConnectionRepository.findById(connId)).thenReturn(Optional.of(conn));
                when(gitHubClient.validateToken("ghp_expired_token")).thenReturn(
                                com.example.livingdocs_backend.application.dto.github.GitHubTokenValidationResult.builder()
                                                .valid(false)
                                                .status("EXPIRED")
                                                .message("Token expired")
                                                .build());

                var result = repositoryService.verifyConnectionToken(connId, 10L);

                assertNotNull(result);
                assertFalse(result.isValid());
                assertEquals("EXPIRED", result.getStatus());
                assertTrue(result.getWarningMessage().contains("đã hết hạn"));

                verify(gitHubConnectionRepository).save(conn);
                verify(auditServicePort).recordSecurityAction(eq(10L), eq(AuditAction.GITHUB_TOKEN_EXPIRED),
                                eq("GITHUB_CONNECTION"), eq("102"), anyString());
        }
}

