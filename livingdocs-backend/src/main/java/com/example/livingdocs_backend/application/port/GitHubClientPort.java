package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPublishResultDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.application.dto.github.GitHubTokenValidationResult;

import java.util.List;

/**
 * Port giao tiếp với GitHub REST API.
 * Cung cấp các thao tác lấy danh sách file repo, thông tin PR, danh sách commit,
 * có xử lý lỗi rate limit và mapping dữ liệu domain/application.
 */
public interface GitHubClientPort {

    /**
     * Lấy toàn bộ cây thư mục/danh sách file trong repo tại một branch hoặc commit cụ thể.
     */
    List<GitHubFileDto> getRepositoryTree(String token, String owner, String repo, String treeSha, boolean recursive);

    /**
     * Lấy thông tin chi tiết một Pull Request.
     */
    GitHubPullRequestDto getPullRequest(String token, String owner, String repo, int prNumber);

    /**
     * Lấy danh sách Pull Request của repository.
     */
    List<GitHubPullRequestDto> listPullRequests(String token, String owner, String repo, String state);

    /**
     * Lấy danh sách Commit của repository (hoặc theo một branch/PR).
     */
    List<GitHubCommitDto> listCommits(String token, String owner, String repo, String sha, int limit);

    /**
     * Tạo hoặc cập nhật file trong GitHub repository (Tạo commit lên branch chỉ định).
     */
    String createOrUpdateFile(String token, String owner, String repo, String filePath, String content, String commitMessage, String branch);

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
     * Đăng bình luận (Comment) lên Pull Request qua GitHub REST API.
     */
    Long createPullRequestComment(String token, String owner, String repo, int prNumber, String body);

    /**
     * Kiểm tra tính hợp lệ của access token kết nối GitHub.
     */
    GitHubTokenValidationResult validateToken(String token);
}
