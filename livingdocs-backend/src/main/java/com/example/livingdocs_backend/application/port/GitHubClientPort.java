package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.github.GitHubCheckRunResultDto;
import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPrFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPublishResultDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.application.dto.github.GitHubTokenValidationResult;

import java.util.Collections;
import java.util.List;

/**
 * Port giao tiếp với GitHub REST API.
 * Cung cấp các thao tác lấy danh sách file repo, thông tin PR, danh sách
 * commit,
 * có xử lý lỗi rate limit và mapping dữ liệu domain/application.
 */
public interface GitHubClientPort {

    /**
     * Lấy toàn bộ cây thư mục/danh sách file trong repo tại một branch hoặc commit
     * cụ thể.
     */
    List<GitHubFileDto> getRepositoryTree(String token, String owner, String repo, String treeSha, boolean recursive);

    /**
     * Lấy thông tin chi tiết một Pull Request.
     */
    GitHubPullRequestDto getPullRequest(String token, String owner, String repo, int prNumber);

    /**
     * Lấy danh sách các file bị thay đổi (diff) trong một Pull Request.
     */
    default List<GitHubPrFileDto> getPullRequestFiles(String token, String owner, String repo, int prNumber) {
        return Collections.emptyList();
    }

    /**
     * Lấy danh sách Pull Request của repository.
     */
    List<GitHubPullRequestDto> listPullRequests(String token, String owner, String repo, String state);

    /**
     * Lấy danh sách Commit của repository (hoặc theo một branch/PR).
     */
    List<GitHubCommitDto> listCommits(String token, String owner, String repo, String sha, int limit);

    /**
     * Lấy danh sách các file bị thay đổi (kèm patch/diff thực tế) của một Commit từ GitHub API.
     */
    default List<GitHubPrFileDto> getCommitFiles(String token, String owner, String repo, String commitSha) {
        return Collections.emptyList();
    }

    /**
     * Tạo hoặc cập nhật file trong GitHub repository (Tạo commit lên branch chỉ
     * định).
     */
    String createOrUpdateFile(String token, String owner, String repo, String filePath, String content,
            String commitMessage, String branch);

    /**
     * Tạo hoặc cập nhật một file trong GitHub repository bằng GitHub Contents API.
     */
    GitHubPublishResultDto putFileContent(String token, String owner, String repo,
            String filePath, String content,
            String commitMessage, String currentSha);

    /**
     * Lấy SHA hiện tại của một file trong repo (null nếu file chưa tồn tại).
     */
    String getCurrentFileSha(String token, String owner, String repo, String filePath);

    /**
     * Lấy nội dung văn bản (UTF-8) của một file từ GitHub Contents API tại một
     * branch hoặc ref.
     * Trả về null nếu file không tồn tại hoặc không thể đọc.
     */
    default String getFileContent(String token, String owner, String repo, String filePath, String ref) {
        return null;
    }

    /**
     * Đăng bình luận (Comment) lên Pull Request qua GitHub REST API.
     */
    Long createPullRequestComment(String token, String owner, String repo, int prNumber, String body);

    /**
     * Cập nhật bình luận (Comment) đã tồn tại trên Pull Request qua GitHub REST
     * API.
     */
    default Long updatePullRequestComment(String token, String owner, String repo, Long commentId, String body) {
        return commentId;
    }

    /**
     * Lấy danh sách bình luận trên Pull Request (Issue Comments).
     */
    default List<com.example.livingdocs_backend.application.dto.github.GitHubCommentDto> listPullRequestComments(
            String token, String owner, String repo, int prNumber) {
        return Collections.emptyList();
    }

    /**
     * Tìm comment cũ của bot trên PR dựa trên marker tag định danh (ví dụ: <!--
     * livingdocs-drift-alert -->).
     */
    default Long findExistingPullRequestComment(String token, String owner, String repo, int prNumber, String marker) {
        return null;
    }

    /**
     * Kiểm tra tính hợp lệ của access token kết nối GitHub.
     */
    GitHubTokenValidationResult validateToken(String token);

    /**
     * Gửi hoặc cập nhật trạng thái kiểm tra (GitHub Checks API / Commit Statuses)
     * phục vụ cơ chế chặn hợp nhất Pull Request khi tài liệu bị sai lệch nghiêm trọng.
     *
     * @param token GitHub Personal Access Token hoặc App Token
     * @param owner Chủ sở hữu repository
     * @param repo Tên repository
     * @param headSha Commit SHA ở đỉnh của PR cần kiểm tra
     * @param checkName Tên của bước kiểm tra (ví dụ: "LivingDocs / Doc Drift Guard")
     * @param status "queued", "in_progress", hoặc "completed"
     * @param conclusion "success", "failure", "neutral", "action_required"
     * @param title Tiêu đề ngắn của Check
     * @param summary Nội dung tóm tắt giải thích lý do chặn hoặc thông báo hợp lệ
     * @param detailsUrl Đường dẫn xem chi tiết trên hệ thống LivingDocs
     */
    default GitHubCheckRunResultDto postCheckRun(
            String token,
            String owner,
            String repo,
            String headSha,
            String checkName,
            String status,
            String conclusion,
            String title,
            String summary,
            String detailsUrl
    ) {
        return null;
    }
}
