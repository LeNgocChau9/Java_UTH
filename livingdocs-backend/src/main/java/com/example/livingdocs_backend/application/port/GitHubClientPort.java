package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;

import java.util.List;

/**
 * Port giao tiếp với GitHub REST API.
 * Cung cấp các thao tác lấy danh sách file repo, thông tin PR, danh sách commit,
 * có xử lý lỗi rate limit và mapping dữ liệu domain/application.
 */
public interface GitHubClientPort {

    /**
     * Lấy toàn bộ cây thư mục/danh sách file trong repo tại một branch hoặc commit cụ thể.
     *
     * @param token      Access token (Personal Access Token hoặc OAuth Token)
     * @param owner      Chủ sở hữu repo (username hoặc tổ chức)
     * @param repo       Tên repo
     * @param treeSha    Branch name (vd: 'main') hoặc Commit SHA
     * @param recursive  True nếu muốn quét đệ quy toàn bộ thư mục con
     * @return Danh sách file và folder
     */
    List<GitHubFileDto> getRepositoryTree(String token, String owner, String repo, String treeSha, boolean recursive);

    /**
     * Lấy thông tin chi tiết một Pull Request.
     *
     * @param token    Access token
     * @param owner    Chủ sở hữu repo
     * @param repo     Tên repo
     * @param prNumber Số thứ tự của PR
     * @return Thông tin PR
     */
    GitHubPullRequestDto getPullRequest(String token, String owner, String repo, int prNumber);

    /**
     * Lấy danh sách Pull Request của repository.
     *
     * @param token  Access token
     * @param owner  Chủ sở hữu repo
     * @param repo   Tên repo
     * @param state  Trạng thái PR: "open", "closed", "all"
     * @return Danh sách PR
     */
    List<GitHubPullRequestDto> listPullRequests(String token, String owner, String repo, String state);

    /**
     * Lấy danh sách Commit của repository (hoặc theo một branch/PR).
     *
     * @param token  Access token
     * @param owner  Chủ sở hữu repo
     * @param repo   Tên repo
     * @param sha    Branch name hoặc SHA (tuỳ chọn, để null nếu lấy branch mặc định)
     * @param limit  Số lượng commit tối đa (vd: 30, 100)
     * @return Danh sách commit
     */
    List<GitHubCommitDto> listCommits(String token, String owner, String repo, String sha, int limit);
}
