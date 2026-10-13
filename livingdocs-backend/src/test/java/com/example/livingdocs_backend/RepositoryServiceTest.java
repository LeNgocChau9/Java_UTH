package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.github.*;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.RepositoryServiceImpl;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCommitRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RepositoryServiceTest {

    private SpringDataRepositoryRepository repositoryRepository;
    private SpringDataPullRequestRepository pullRequestRepository;
    private SpringDataCommitRepository commitRepository;
    private SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private GitHubClientPort gitHubClient;

    private RepositoryServiceImpl repositoryService;

    @BeforeEach
    void setUp() {
        repositoryRepository = mock(SpringDataRepositoryRepository.class);
        pullRequestRepository = mock(SpringDataPullRequestRepository.class);
        commitRepository = mock(SpringDataCommitRepository.class);
        gitHubConnectionRepository = mock(SpringDataGitHubConnectionRepository.class);
        gitHubClient = mock(GitHubClientPortPort.class != null ? GitHubClientPort.class : GitHubClientPort.class);

        repositoryService = new RepositoryServiceImpl(
                repositoryRepository,
                pullRequestRepository,
                commitRepository,
                gitHubConnectionRepository,
                gitHubClient
        );
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
}
