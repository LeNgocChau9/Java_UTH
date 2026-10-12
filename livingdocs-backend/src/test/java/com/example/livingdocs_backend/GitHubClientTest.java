package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.domain.exception.GitHubApiException;
import com.example.livingdocs_backend.domain.exception.GitHubRateLimitException;
import com.example.livingdocs_backend.infrastructure.github.GitHubClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GitHubClientTest {

    private final RestClient.Builder restClientBuilder = RestClient.builder().baseUrl("https://api.github.com");
    private final MockRestServiceServer mockServer = MockRestServiceServer.bindTo(restClientBuilder).build();
    private final GitHubClient gitHubClient = new GitHubClient(restClientBuilder.build());

    private final String sampleToken = "ghp_mocktoken123456789";
    private final String owner = "myorg";
    private final String repo = "livingdocs";

    @Nested
    @DisplayName("1. Lấy danh sách File / Cây thư mục (getRepositoryTree)")
    class GetRepositoryTreeTests {

        @Test
        @DisplayName("Thành công: Lấy danh sách files và folders trong repo")
        void shouldReturnFilesAndFoldersSuccessfully() {
            String jsonResponse = """
                    {
                      "sha": "tree_sha_123",
                      "tree": [
                        {
                          "path": "src/main/App.java",
                          "mode": "100644",
                          "type": "blob",
                          "sha": "blob_sha_1",
                          "size": 1024,
                          "url": "https://api.github.com/git/blobs/blob_sha_1"
                        },
                        {
                          "path": "docs",
                          "mode": "040000",
                          "type": "tree",
                          "sha": "tree_sha_2",
                          "size": null,
                          "url": "https://api.github.com/git/trees/tree_sha_2"
                        }
                      ],
                      "truncated": false
                    }
                    """;

            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/git/trees/main?recursive=1"))
                    .andExpect(method(HttpMethod.GET))
                    .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer " + sampleToken))
                    .andExpect(header("X-GitHub-Api-Version", "2022-11-28"))
                    .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

            List<GitHubFileDto> files = gitHubClient.getRepositoryTree(sampleToken, owner, repo, "main", true);

            mockServer.verify();
            assertNotNull(files);
            assertEquals(2, files.size());

            GitHubFileDto file = files.get(0);
            assertEquals("src/main/App.java", file.path());
            assertTrue(file.isFile());
            assertFalse(file.isDirectory());
            assertEquals("blob_sha_1", file.sha());
            assertEquals(1024L, file.size());

            GitHubFileDto folder = files.get(1);
            assertEquals("docs", folder.path());
            assertTrue(folder.isDirectory());
            assertFalse(folder.isFile());
        }
    }

    @Nested
    @DisplayName("2. Lấy thông tin Pull Request (getPullRequest & listPullRequests)")
    class PullRequestTests {

        @Test
        @DisplayName("Thành công: Lấy chi tiết 1 Pull Request theo số PR")
        void shouldReturnSinglePullRequestDetails() {
            String jsonResponse = """
                    {
                      "id": 987654321,
                      "number": 42,
                      "title": "feat: thêm tính năng quét tài liệu",
                      "body": "Mô tả chi tiết PR",
                      "state": "open",
                      "merged": false,
                      "html_url": "https://github.com/myorg/livingdocs/pull/42",
                      "head": {
                        "ref": "feature/scan-docs",
                        "sha": "head_sha_99"
                      },
                      "base": {
                        "ref": "main",
                        "sha": "base_sha_00"
                      },
                      "user": {
                        "id": 111,
                        "login": "dev_user",
                        "avatar_url": "https://avatars.githubusercontent.com/u/111"
                      },
                      "created_at": "2026-10-10T10:00:00Z",
                      "updated_at": "2026-10-10T11:00:00Z"
                    }
                    """;

            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/pulls/42"))
                    .andExpect(method(HttpMethod.GET))
                    .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer " + sampleToken))
                    .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

            GitHubPullRequestDto pr = gitHubClient.getPullRequest(sampleToken, owner, repo, 42);

            mockServer.verify();
            assertNotNull(pr);
            assertEquals(42, pr.number());
            assertEquals("feat: thêm tính năng quét tài liệu", pr.title());
            assertEquals("feature/scan-docs", pr.headBranch());
            assertEquals("head_sha_99", pr.headCommitSha());
            assertEquals("main", pr.baseBranch());
            assertEquals("base_sha_00", pr.baseCommitSha());
            assertEquals("dev_user", pr.authorLogin());
            assertEquals(Instant.parse("2026-10-10T10:00:00Z"), pr.createdAt());
        }

        @Test
        @DisplayName("Thành công: Lấy danh sách Pull Requests")
        void shouldReturnListOfPullRequests() {
            String jsonResponse = """
                    [
                      {
                        "id": 1,
                        "number": 10,
                        "title": "PR 10",
                        "state": "open"
                      },
                      {
                        "id": 2,
                        "number": 11,
                        "title": "PR 11",
                        "state": "open"
                      }
                    ]
                    """;

            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/pulls?state=open&per_page=100"))
                    .andExpect(method(HttpMethod.GET))
                    .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

            List<GitHubPullRequestDto> list = gitHubClient.listPullRequests(sampleToken, owner, repo, "open");

            mockServer.verify();
            assertNotNull(list);
            assertEquals(2, list.size());
            assertEquals(10, list.get(0).number());
            assertEquals(11, list.get(1).number());
        }
    }

    @Nested
    @DisplayName("3. Lấy danh sách Commit (listCommits)")
    class CommitTests {

        @Test
        @DisplayName("Thành công: Lấy danh sách commits với author, committer, SHA")
        void shouldReturnListOfCommits() {
            String jsonResponse = """
                    [
                      {
                        "sha": "commit_sha_abc123",
                        "html_url": "https://github.com/myorg/livingdocs/commit/commit_sha_abc123",
                        "commit": {
                          "message": "fix: sửa lỗi parsing",
                          "author": {
                            "name": "Ngoc Chau",
                            "email": "chau@example.com",
                            "date": "2026-10-12T08:00:00Z"
                          },
                          "committer": {
                            "name": "GitHub",
                            "email": "noreply@github.com",
                            "date": "2026-10-12T08:00:00Z"
                          }
                        },
                        "parents": [
                          { "sha": "parent_sha_0" }
                        ]
                      }
                    ]
                    """;

            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/commits?per_page=10&sha=main"))
                    .andExpect(method(HttpMethod.GET))
                    .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

            List<GitHubCommitDto> commits = gitHubClient.listCommits(sampleToken, owner, repo, "main", 10);

            mockServer.verify();
            assertNotNull(commits);
            assertEquals(1, commits.size());

            GitHubCommitDto c = commits.get(0);
            assertEquals("commit_sha_abc123", c.sha());
            assertEquals("fix: sửa lỗi parsing", c.message());
            assertEquals("Ngoc Chau", c.authorName());
            assertEquals("chau@example.com", c.authorEmail());
            assertEquals(Instant.parse("2026-10-12T08:00:00Z"), c.authorDate());
            assertEquals(List.of("parent_sha_0"), c.parentShas());
        }
    }

    @Nested
    @DisplayName("4. Xử lý lỗi Rate Limit & HTTP Errors")
    class RateLimitAndErrorHandlingTests {

        @Test
        @DisplayName("Xử lý lỗi 403 Rate Limit: Trích xuất x-ratelimit-reset, limit, remaining và ném GitHubRateLimitException")
        void shouldThrowGitHubRateLimitExceptionOn403RateLimit() {
            long resetEpoch = 1791800000L;
            HttpHeaders headers = new HttpHeaders();
            headers.add("x-ratelimit-limit", "5000");
            headers.add("x-ratelimit-remaining", "0");
            headers.add("x-ratelimit-reset", String.valueOf(resetEpoch));
            headers.setContentType(MediaType.APPLICATION_JSON);

            String errorBody = """
                    {
                      "message": "API rate limit exceeded for user ID 123.",
                      "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
                    }
                    """;

            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/git/trees/main?recursive=1"))
                    .andRespond(withStatus(HttpStatus.FORBIDDEN)
                            .headers(headers)
                            .body(errorBody));

            GitHubRateLimitException ex = assertThrows(GitHubRateLimitException.class, () ->
                    gitHubClient.getRepositoryTree(sampleToken, owner, repo, "main", true)
            );

            mockServer.verify();
            assertEquals(5000, ex.getLimit());
            assertEquals(0, ex.getRemaining());
            assertEquals(Instant.ofEpochSecond(resetEpoch), ex.getResetTime());
            assertTrue(ex.getMessage().contains("Rate Limit vượt quá ngưỡng cho phép"));
        }

        @Test
        @DisplayName("Xử lý lỗi 429 Too Many Requests: Ném GitHubRateLimitException")
        void shouldThrowGitHubRateLimitExceptionOn429() {
            HttpHeaders headers = new HttpHeaders();
            headers.add("x-ratelimit-limit", "60");
            headers.add("x-ratelimit-remaining", "0");
            headers.add("x-ratelimit-reset", "1791800000");
            headers.setContentType(MediaType.APPLICATION_JSON);

            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/pulls/10"))
                    .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                            .headers(headers)
                            .body("{\"message\": \"Too Many Requests\"}"));

            assertThrows(GitHubRateLimitException.class, () ->
                    gitHubClient.getPullRequest(sampleToken, owner, repo, 10)
            );

            mockServer.verify();
        }

        @Test
        @DisplayName("Xử lý lỗi 404 Not Found: Ném GitHubApiException với mã 404")
        void shouldThrowGitHubApiExceptionOn404() {
            mockServer.expect(requestTo("https://api.github.com/repos/myorg/livingdocs/pulls/999"))
                    .andRespond(withStatus(HttpStatus.NOT_FOUND)
                            .body("{\"message\": \"Not Found\"}"));

            GitHubApiException ex = assertThrows(GitHubApiException.class, () ->
                    gitHubClient.getPullRequest(sampleToken, owner, repo, 999)
            );

            mockServer.verify();
            assertEquals(404, ex.getStatusCode());
        }
    }
}
