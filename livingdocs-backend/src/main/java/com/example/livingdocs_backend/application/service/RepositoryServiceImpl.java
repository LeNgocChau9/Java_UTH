import com.example.livingdocs_backend.application.dto.github.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.port.RepositoryServicePort;
import com.example.livingdocs_backend.domain.exception.GitHubApiException;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CommitEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCommitRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RepositoryServiceImpl implements RepositoryServicePort {

    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataPullRequestRepository pullRequestRepository;
    private final SpringDataCommitRepository commitRepository;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final GitHubClientPort gitHubClient;
    private final AuditServicePort auditServicePort;


    private static final Long DEFAULT_WORKSPACE_ID = 1L;

    @Override
    @Transactional
    public RepoResponse addRepository(CreateRepoRequest request, Long currentUserId) {
        Long workspaceId = request.workspaceId() != null ? request.workspaceId() : DEFAULT_WORKSPACE_ID;
        String repoFullName = request.repoFullName().trim();
        String repoName = StringUtils.hasText(request.repoName())
                ? request.repoName().trim()
                : extractRepoName(repoFullName);

        // Kiểm tra xem repo đã tồn tại trong workspace này chưa
        Optional<RepositoryEntity> existing = repositoryRepository.findByWorkspaceIdAndRepoFullName(workspaceId, repoFullName);
        if (existing.isPresent()) {
            return mapToRepoResponse(existing.get());
        }

        // Tìm hoặc tạo kết nối GitHub connection cho workspace
        Long connectionId = resolveOrCreateConnection(workspaceId, currentUserId, request.githubToken(), repoFullName);

        Long githubRepoId = request.githubRepoId() != null
                ? request.githubRepoId()
                : (long) Math.abs(repoFullName.hashCode());

        RepositoryEntity entity = RepositoryEntity.builder()
                .workspaceId(workspaceId)
                .connectionId(connectionId)
                .githubRepoId(githubRepoId)
                .repoName(repoName)
                .repoFullName(repoFullName)
                .defaultBranch(StringUtils.hasText(request.defaultBranch()) ? request.defaultBranch().trim() : "main")
                .cloneUrl(StringUtils.hasText(request.cloneUrl()) ? request.cloneUrl().trim() : "https://github.com/" + repoFullName + ".git")
                .isActive(true)
                .autoDocEnabled(true)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        RepositoryEntity saved = repositoryRepository.save(entity);
        log.info("Đã thêm Repository [{}] vào Workspace [{}] thành công", repoFullName, workspaceId);
        return mapToRepoResponse(saved);
    }

    @Override
    @Transactional
    public SyncRepoResponse syncRepository(Long repositoryId, String explicitToken, Long currentUserId) {
        RepositoryEntity repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new GitHubApiException("Không tìm thấy repository với ID: " + repositoryId, 404));

        String[] parts = parseOwnerAndRepo(repo.getRepoFullName());
        String owner = parts[0];
        String repoName = parts[1];

        // Lấy token để gọi GitHub API
        String token = resolveTokenForSync(repo, explicitToken, currentUserId);

        log.info("Bắt đầu đồng bộ repository [{}] (ID: {})...", repo.getRepoFullName(), repositoryId);

        // 1. Đồng bộ Pull Requests (cả open và closed)
        int syncedPrs = syncPullRequests(repo, token, owner, repoName);

        // 2. Đồng bộ Commits
        int syncedCommits = syncCommits(repo, token, owner, repoName);

        // 3. Cập nhật last_synced_at
        Instant now = Instant.now();
        repo.setLastSyncedAt(now);
        repo.setUpdatedAt(now);
        repositoryRepository.save(repo);

        log.info("Hoàn tất đồng bộ [{}]: {} PRs, {} Commits", repo.getRepoFullName(), syncedPrs, syncedCommits);

        return SyncRepoResponse.builder()
                .repositoryId(repo.getRepositoryId())
                .repoFullName(repo.getRepoFullName())
                .syncedPullRequestsCount(syncedPrs)
                .syncedCommitsCount(syncedCommits)
                .syncedAt(now)
                .message("Đồng bộ repository thành công!")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RepoResponse> listRepositories(Long workspaceId) {
        Long targetWorkspaceId = workspaceId != null ? workspaceId : DEFAULT_WORKSPACE_ID;
        return repositoryRepository.findByWorkspaceId(targetWorkspaceId).stream()
                .map(this::mapToRepoResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RepoResponse getRepository(Long repositoryId) {
        RepositoryEntity repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new GitHubApiException("Không tìm thấy repository với ID: " + repositoryId, 404));
        return mapToRepoResponse(repo);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PullRequestEntity> getRepoPullRequests(Long repositoryId) {
        return pullRequestRepository.findByRepositoryId(repositoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommitEntity> getRepoCommits(Long repositoryId) {
        return commitRepository.findByRepositoryId(repositoryId);
    }


    private int syncPullRequests(RepositoryEntity repo, String token, String owner, String repoName) {
        List<GitHubPullRequestDto> prs;
        try {
            prs = gitHubClient.listPullRequests(token, owner, repoName, "all");
        } catch (Exception ex) {
            log.warn("Không thể lấy danh sách PR cho {}/{} (thử lấy open): {}", owner, repoName, ex.getMessage());
            prs = gitHubClient.listPullRequests(token, owner, repoName, "open");
        }

        int count = 0;
        for (GitHubPullRequestDto prDto : prs) {
            if (prDto.number() == null) continue;

            PullRequestEntity prEntity = pullRequestRepository
                    .findByRepositoryIdAndPrNumber(repo.getRepositoryId(), prDto.number())
                    .orElseGet(() -> PullRequestEntity.builder()
                            .repositoryId(repo.getRepositoryId())
                            .prNumber(prDto.number())
                            .createdAt(Instant.now())
                            .build());

            prEntity.setGithubPrId(prDto.id() != null ? prDto.id() : (long) prDto.number());
            prEntity.setTitle(StringUtils.hasText(prDto.title()) ? prDto.title() : "No Title");
            prEntity.setHeadBranch(prDto.headBranch() != null ? prDto.headBranch() : "");
            prEntity.setBaseBranch(prDto.baseBranch() != null ? prDto.baseBranch() : repo.getDefaultBranch());
            prEntity.setHeadCommitHash(prDto.headCommitSha() != null ? prDto.headCommitSha() : "");
            prEntity.setBaseCommitHash(prDto.baseCommitSha() != null ? prDto.baseCommitSha() : "");
            prEntity.setState(prDto.state() != null ? prDto.state().toUpperCase() : "OPEN");
            prEntity.setAuthorUsername(prDto.authorLogin());
            prEntity.setGithubCreatedAt(prDto.createdAt());
            prEntity.setGithubUpdatedAt(prDto.updatedAt());
            prEntity.setGithubClosedAt(prDto.closedAt());
            prEntity.setUpdatedAt(Instant.now());

            pullRequestRepository.save(prEntity);
            count++;
        }
        return count;
    }

    private int syncCommits(RepositoryEntity repo, String token, String owner, String repoName) {
        List<GitHubCommitDto> commits = gitHubClient.listCommits(token, owner, repoName, repo.getDefaultBranch(), 50);

        int count = 0;
        for (GitHubCommitDto commitDto : commits) {
            if (!StringUtils.hasText(commitDto.sha())) continue;

            CommitEntity commitEntity = commitRepository
                    .findByRepositoryIdAndCommitHash(repo.getRepositoryId(), commitDto.sha())
                    .orElseGet(() -> CommitEntity.builder()
                            .repositoryId(repo.getRepositoryId())
                            .commitHash(commitDto.sha())
                            .createdAt(Instant.now())
                            .build());

            commitEntity.setAuthorName(commitDto.authorName() != null ? commitDto.authorName() : "Unknown");
            commitEntity.setAuthorEmail(commitDto.authorEmail());
            commitEntity.setCommitMessage(commitDto.message() != null ? commitDto.message() : "");
            commitEntity.setCommittedAt(commitDto.authorDate() != null ? commitDto.authorDate() : Instant.now());

            commitRepository.save(commitEntity);
            count++;
        }
        return count;
    }

    private Long resolveOrCreateConnection(Long workspaceId, Long userId, String token, String repoFullName) {
        Long effectiveUserId = userId != null ? userId : 1L;

        return gitHubConnectionRepository.findByWorkspaceIdAndUserId(workspaceId, effectiveUserId)
                .map(GitHubConnectionEntity::getConnectionId)
                .orElseGet(() -> {
                    String owner = parseOwnerAndRepo(repoFullName)[0];
                    GitHubConnectionEntity conn = GitHubConnectionEntity.builder()
                            .workspaceId(workspaceId)
                            .userId(effectiveUserId)
                            .githubUsername(owner)
                            .accessTokenEncrypted(StringUtils.hasText(token) ? token.trim() : "DUMMY_TOKEN")
                            .status("CONNECTED")
                            .createdAt(Instant.now())
                            .updatedAt(Instant.now())
                            .build();
                    return gitHubConnectionRepository.save(conn).getConnectionId();
                });
    }

    private String resolveTokenForSync(RepositoryEntity repo, String explicitToken, Long currentUserId) {
        if (StringUtils.hasText(explicitToken)) {
            return explicitToken.trim();
        }

        // Tìm từ connection đã liên kết
        if (repo.getConnectionId() != null) {
            Optional<GitHubConnectionEntity> conn = gitHubConnectionRepository.findById(repo.getConnectionId());
            if (conn.isPresent() && StringUtils.hasText(conn.get().getAccessTokenEncrypted())
                    && !"DUMMY_TOKEN".equals(conn.get().getAccessTokenEncrypted())) {
                return conn.get().getAccessTokenEncrypted();
            }
        }

        // Tìm connection của workspace
        Optional<GitHubConnectionEntity> wsConn = gitHubConnectionRepository
                .findFirstByWorkspaceIdOrderByCreatedAtDesc(repo.getWorkspaceId());
        if (wsConn.isPresent() && StringUtils.hasText(wsConn.get().getAccessTokenEncrypted())
                && !"DUMMY_TOKEN".equals(wsConn.get().getAccessTokenEncrypted())) {
            return wsConn.get().getAccessTokenEncrypted();
        }

        return null;
    }

    private String extractRepoName(String repoFullName) {
        int idx = repoFullName.lastIndexOf('/');
        return (idx >= 0 && idx < repoFullName.length() - 1) ? repoFullName.substring(idx + 1) : repoFullName;
    }

    private String[] parseOwnerAndRepo(String repoFullName) {
        String[] parts = repoFullName.split("/", 2);
        if (parts.length < 2) {
            return new String[]{repoFullName, repoFullName};
        }
        return new String[]{parts[0].trim(), parts[1].trim()};
    }

    @Override
    @Transactional
    public GitHubConnectionStatusResponse verifyConnectionToken(Long connectionId, Long currentUserId) {
        GitHubConnectionEntity connection = gitHubConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kết nối GitHub với ID: " + connectionId));

        return doVerifyAndProcessConnection(connection, currentUserId);
    }

    @Override
    @Transactional
    public List<GitHubConnectionStatusResponse> verifyWorkspaceConnections(Long workspaceId, Long currentUserId) {
        List<GitHubConnectionEntity> connections;
        if (workspaceId != null) {
            connections = gitHubConnectionRepository.findByWorkspaceId(workspaceId);
        } else {
            connections = gitHubConnectionRepository.findAll();
        }

        List<GitHubConnectionStatusResponse> results = new ArrayList<>();
        for (GitHubConnectionEntity conn : connections) {
            results.add(doVerifyAndProcessConnection(conn, currentUserId));
        }
        return results;
    }

    private GitHubConnectionStatusResponse doVerifyAndProcessConnection(GitHubConnectionEntity connection, Long currentUserId) {
        String token = connection.getAccessTokenEncrypted();
        Instant now = Instant.now();

        // 1. Kiểm tra ngày hết hạn cục bộ nếu có
        boolean locallyExpired = connection.getTokenExpiresAt() != null && connection.getTokenExpiresAt().isBefore(now);

        // 2. Gọi GitHub REST API qua GitHubClient để kiểm tra tính hợp lệ thực tế
        GitHubTokenValidationResult valResult = gitHubClient.validateToken(token);

        String previousStatus = connection.getStatus();
        String newStatus;
        String warningMessage = null;

        if (locallyExpired || "EXPIRED".equalsIgnoreCase(valResult.getStatus())) {
            newStatus = "EXPIRED";
            warningMessage = "CẢNH BÁO: Access Token GitHub cho tài khoản @" + connection.getGithubUsername()
                    + " đã hết hạn. Vui lòng kết nối lại tài khoản GitHub để không làm gián đoạn tự động hóa tài liệu.";
        } else if (!valResult.isValid() || "REVOKED".equalsIgnoreCase(valResult.getStatus())) {
            newStatus = "REVOKED";
            warningMessage = "CẢNH BÁO: Access Token GitHub cho tài khoản @" + connection.getGithubUsername()
                    + " không hợp lệ hoặc đã bị thu hồi (Revoked). Vui lòng cấp lại token mới.";
        } else {
            newStatus = "CONNECTED";
        }

        // 3. Cập nhật trạng thái trong database
        connection.setStatus(newStatus);
        if (valResult.getExpiresAt() != null) {
            connection.setTokenExpiresAt(valResult.getExpiresAt());
        }
        if (StringUtils.hasText(valResult.getScopes())) {
            connection.setTokenScope(valResult.getScopes());
        }
        connection.setUpdatedAt(now);
        gitHubConnectionRepository.save(connection);

        // 4. Nếu trạng thái token bị lỗi (hết hạn hoặc revoked), bắn cảnh báo tới người dùng và ghi nhật ký kiểm toán
        if (!"CONNECTED".equals(newStatus)) {
            AuditAction auditAction = "EXPIRED".equals(newStatus)
                    ? AuditAction.GITHUB_TOKEN_EXPIRED
                    : AuditAction.GITHUB_TOKEN_REVOKED;

            Long actorId = currentUserId != null ? currentUserId : connection.getUserId();
            String detail = String.format("Token GitHub của user @%s (connectionId=%d, workspaceId=%d) không còn hợp lệ: %s. Trạng thái chuyển từ %s -> %s",
                    connection.getGithubUsername(), connection.getConnectionId(), connection.getWorkspaceId(),
                    warningMessage, previousStatus, newStatus);

            auditServicePort.recordSecurityAction(actorId, auditAction, "GITHUB_CONNECTION",
                    connection.getConnectionId().toString(), detail);

            log.warn("[SECURITY ALERT] {}", detail);
        }

        return GitHubConnectionStatusResponse.builder()
                .connectionId(connection.getConnectionId())
                .workspaceId(connection.getWorkspaceId())
                .userId(connection.getUserId())
                .githubUsername(connection.getGithubUsername())
                .status(newStatus)
                .valid("CONNECTED".equals(newStatus))
                .tokenScope(connection.getTokenScope())
                .tokenExpiresAt(connection.getTokenExpiresAt())
                .lastCheckedAt(now)
                .warningMessage(warningMessage)
                .build();
    }

    private RepoResponse mapToRepoResponse(RepositoryEntity entity) {
        return RepoResponse.builder()
                .repositoryId(entity.getRepositoryId())
                .workspaceId(entity.getWorkspaceId())
                .connectionId(entity.getConnectionId())
                .githubRepoId(entity.getGithubRepoId())
                .repoName(entity.getRepoName())
                .repoFullName(entity.getRepoFullName())
                .defaultBranch(entity.getDefaultBranch())
                .cloneUrl(entity.getCloneUrl())
                .isActive(entity.getIsActive())
                .autoDocEnabled(entity.getAutoDocEnabled())
                .lastSyncedAt(entity.getLastSyncedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

