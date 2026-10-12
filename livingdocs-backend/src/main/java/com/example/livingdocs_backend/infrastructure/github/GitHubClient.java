package com.example.livingdocs_backend.infrastructure.github;

import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.domain.exception.GitHubApiException;
import com.example.livingdocs_backend.domain.exception.GitHubRateLimitException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

/**
 * Triển khai gọi GitHub REST API v3 sử dụng RestClient của Spring Framework 6 / Spring Boot 3.
 * Hỗ trợ các chức năng:
 *  - Lấy danh sách file / cây thư mục trong repository (Git Trees API)
 *  - Lấy thông tin Pull Request (chi tiết và danh sách)
 *  - Lấy danh sách Commits
 *  - Xử lý Rate Limit (HTTP 403 / 429) với thông tin reset time, limit, remaining.
 */
@Slf4j
@Component
public class GitHubClient implements GitHubClientPort {

    private static final String DEFAULT_BASE_URL = "https://api.github.com";
    private static final String GITHUB_API_VERSION = "2022-11-28";

    private final RestClient restClient;

    public GitHubClient() {
        this(RestClient.builder().baseUrl(DEFAULT_BASE_URL).build());
    }

    public GitHubClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public List<GitHubFileDto> getRepositoryTree(String token, String owner, String repo, String treeSha, boolean recursive) {
        String targetTreeSha = StringUtils.hasText(treeSha) ? treeSha : "HEAD";
        String uri = UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/git/trees/{tree_sha}")
                .queryParam("recursive", recursive ? "1" : "0")
                .buildAndExpand(owner, repo, targetTreeSha)
                .toUriString();

        try {
            GitTreeResponse response = executeWithAuth(token, uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(GitTreeResponse.class);

            if (response == null || response.tree() == null) {
                return Collections.emptyList();
            }

            return response.tree().stream()
                    .map(item -> GitHubFileDto.builder()
                            .path(item.path())
                            .mode(item.mode())
                            .type(item.type())
                            .sha(item.sha())
                            .size(item.size())
                            .url(item.url())
                            .build())
                    .toList();
        } catch (RestClientResponseException ex) {
            handleErrorResponse(ex, "getRepositoryTree (" + owner + "/" + repo + " @" + targetTreeSha + ")");
            return Collections.emptyList();
        } catch (Exception ex) {
            log.error("Lỗi không mong muốn khi gọi getRepositoryTree cho {}/{}: {}", owner, repo, ex.getMessage(), ex);
            throw new GitHubApiException("Lỗi khi lấy danh sách file repo " + owner + "/" + repo + ": " + ex.getMessage(), 500, ex);
        }
    }

    @Override
    public GitHubPullRequestDto getPullRequest(String token, String owner, String repo, int prNumber) {
        String uri = "/repos/{owner}/{repo}/pulls/{pull_number}";

        try {
            GitPullResponse pr = executeWithAuth(token, uri, owner, repo, prNumber)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(GitPullResponse.class);

            if (pr == null) {
                throw new GitHubApiException("Không tìm thấy PR #" + prNumber + " của repo " + owner + "/" + repo, 404);
            }

            return mapToPullRequestDto(pr);
        } catch (RestClientResponseException ex) {
            handleErrorResponse(ex, "getPullRequest (" + owner + "/" + repo + " #" + prNumber + ")");
            return null;
        } catch (GitHubApiException | GitHubRateLimitException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Lỗi khi lấy thông tin PR #{} của {}/{}: {}", prNumber, owner, repo, ex.getMessage(), ex);
            throw new GitHubApiException("Lỗi khi lấy thông tin PR #" + prNumber + ": " + ex.getMessage(), 500, ex);
        }
    }

    @Override
    public List<GitHubPullRequestDto> listPullRequests(String token, String owner, String repo, String state) {
        String targetState = StringUtils.hasText(state) ? state : "open";
        String uri = UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/pulls")
                .queryParam("state", targetState)
                .queryParam("per_page", 100)
                .buildAndExpand(owner, repo)
                .toUriString();

        try {
            List<GitPullResponse> list = executeWithAuth(token, uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<GitPullResponse>>() {});

            if (list == null) {
                return Collections.emptyList();
            }

            return list.stream()
                    .map(this::mapToPullRequestDto)
                    .toList();
        } catch (RestClientResponseException ex) {
            handleErrorResponse(ex, "listPullRequests (" + owner + "/" + repo + ")");
            return Collections.emptyList();
        } catch (Exception ex) {
            log.error("Lỗi khi lấy danh sách PR của {}/{}: {}", owner, repo, ex.getMessage(), ex);
            throw new GitHubApiException("Lỗi khi lấy danh sách PR của " + owner + "/" + repo + ": " + ex.getMessage(), 500, ex);
        }
    }

    @Override
    public List<GitHubCommitDto> listCommits(String token, String owner, String repo, String sha, int limit) {
        int perPage = (limit > 0 && limit <= 100) ? limit : 30;
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/commits")
                .queryParam("per_page", perPage);
        if (StringUtils.hasText(sha)) {
            builder.queryParam("sha", sha);
        }
        String uri = builder.buildAndExpand(owner, repo).toUriString();

        try {
            List<GitCommitResponse> commits = executeWithAuth(token, uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<GitCommitResponse>>() {});

            if (commits == null) {
                return Collections.emptyList();
            }

            return commits.stream()
                    .map(c -> {
                        GitCommitDetail detail = c.commit();
                        List<String> parents = c.parents() != null
                                ? c.parents().stream().map(GitParent::sha).toList()
                                : Collections.emptyList();

                        return GitHubCommitDto.builder()
                                .sha(c.sha())
                                .message(detail != null ? detail.message() : null)
                                .authorName(detail != null && detail.author() != null ? detail.author().name() : null)
                                .authorEmail(detail != null && detail.author() != null ? detail.author().email() : null)
                                .authorDate(detail != null && detail.author() != null ? detail.author().date() : null)
                                .committerName(detail != null && detail.committer() != null ? detail.committer().name() : null)
                                .committerEmail(detail != null && detail.committer() != null ? detail.committer().email() : null)
                                .committerDate(detail != null && detail.committer() != null ? detail.committer().date() : null)
                                .htmlUrl(c.htmlUrl())
                                .parentShas(parents)
                                .build();
                    })
                    .toList();
        } catch (RestClientResponseException ex) {
            handleErrorResponse(ex, "listCommits (" + owner + "/" + repo + ")");
            return Collections.emptyList();
        } catch (Exception ex) {
            log.error("Lỗi khi lấy danh sách commit của {}/{}: {}", owner, repo, ex.getMessage(), ex);
            throw new GitHubApiException("Lỗi khi lấy danh sách commit của " + owner + "/" + repo + ": " + ex.getMessage(), 500, ex);
        }
    }

    /**
     * Tạo RestClient request với Header Authentication và GitHub API Version tiêu chuẩn.
     */
    private RestClient.RequestHeadersSpec<?> executeWithAuth(String token, String uri, Object... uriVariables) {
        RestClient.RequestHeadersSpec<?> spec = restClient.get()
                .uri(uri, uriVariables)
                .header(HttpHeaders.USER_AGENT, "LivingDocs-GitHubClient/1.0")
                .header("X-GitHub-Api-Version", GITHUB_API_VERSION);

        if (StringUtils.hasText(token)) {
            spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + token.trim());
        }

        return spec;
    }


    /**
     * Kiểm tra và phân loại lỗi HTTP từ GitHub API, đặc biệt là Rate Limit.
     */
    private void handleErrorResponse(RestClientResponseException ex, String operation) {
        HttpStatusCode status = ex.getStatusCode();
        HttpHeaders headers = ex.getResponseHeaders();

        int limit = parseHeaderInt(headers, "x-ratelimit-limit", 0);
        int remaining = parseHeaderInt(headers, "x-ratelimit-remaining", 0);
        long resetEpoch = parseHeaderLong(headers, "x-ratelimit-reset", 0L);
        Instant resetTime = resetEpoch > 0 ? Instant.ofEpochSecond(resetEpoch) : null;

        String responseBody = ex.getResponseBodyAsString();

        // Kiểm tra mã 429 hoặc 403 khi remaining == 0 hoặc response chứa rate limit
        boolean isRateLimited = status.value() == 429
                || (status.value() == 403 && (remaining == 0 || (responseBody != null && responseBody.toLowerCase().contains("rate limit"))));

        if (isRateLimited) {
            String msg = String.format("GitHub API Rate Limit vượt quá ngưỡng cho phép trong thao tác [%s]. Hạn mức: %d, Còn lại: %d, Reset lúc: %s",
                    operation, limit, remaining, resetTime != null ? resetTime.toString() : "N/A");
            log.warn(msg);
            throw new GitHubRateLimitException(msg, resetTime, limit, remaining);
        }

        log.error("Lỗi HTTP {} từ GitHub API khi thực hiện [{}]: {}", status.value(), operation, responseBody);
        throw new GitHubApiException("GitHub API trả về lỗi HTTP " + status.value() + " (" + operation + "): " + responseBody, status.value(), ex);
    }

    private int parseHeaderInt(HttpHeaders headers, String headerName, int defaultValue) {
        if (headers == null) return defaultValue;
        String val = headers.getFirst(headerName);
        if (val == null) return defaultValue;
        try {
            return Integer.parseInt(val.trim());
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private long parseHeaderLong(HttpHeaders headers, String headerName, long defaultValue) {
        if (headers == null) return defaultValue;
        String val = headers.getFirst(headerName);
        if (val == null) return defaultValue;
        try {
            return Long.parseLong(val.trim());
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private GitHubPullRequestDto mapToPullRequestDto(GitPullResponse pr) {
        return GitHubPullRequestDto.builder()
                .id(pr.id())
                .number(pr.number())
                .title(pr.title())
                .body(pr.body())
                .state(pr.state())
                .headBranch(pr.head() != null ? pr.head().ref() : null)
                .headCommitSha(pr.head() != null ? pr.head().sha() : null)
                .baseBranch(pr.base() != null ? pr.base().ref() : null)
                .baseCommitSha(pr.base() != null ? pr.base().sha() : null)
                .authorLogin(pr.user() != null ? pr.user().login() : null)
                .authorAvatarUrl(pr.user() != null ? pr.user().avatarUrl() : null)
                .htmlUrl(pr.htmlUrl())
                .merged(pr.merged())
                .createdAt(pr.createdAt())
                .updatedAt(pr.updatedAt())
                .closedAt(pr.closedAt())
                .mergedAt(pr.mergedAt())
                .build();
    }

    // --- JSON Mapping Record Classes cho GitHub REST API ---

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitTreeResponse(
            String sha,
            String url,
            List<GitTreeItem> tree,
            Boolean truncated
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitTreeItem(
            String path,
            String mode,
            String type,
            String sha,
            Long size,
            String url
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitPullResponse(
            Long id,
            Integer number,
            String title,
            String body,
            String state,
            Boolean merged,
            @JsonProperty("html_url") String htmlUrl,
            GitBranchRef head,
            GitBranchRef base,
            GitUserRef user,
            @JsonProperty("created_at") Instant createdAt,
            @JsonProperty("updated_at") Instant updatedAt,
            @JsonProperty("closed_at") Instant closedAt,
            @JsonProperty("merged_at") Instant mergedAt
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitBranchRef(
            String ref,
            String sha
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitUserRef(
            Long id,
            String login,
            @JsonProperty("avatar_url") String avatarUrl
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitCommitResponse(
            String sha,
            @JsonProperty("html_url") String htmlUrl,
            GitCommitDetail commit,
            List<GitParent> parents
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitCommitDetail(
            String message,
            GitCommitAuthor author,
            GitCommitAuthor committer
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitCommitAuthor(
            String name,
            String email,
            Instant date
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GitParent(
            String sha
    ) {}
}
