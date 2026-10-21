package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.github.GitHubCommitDto;
import com.example.livingdocs_backend.application.dto.github.GitHubFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPublishResultDto;
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

    /**
     * Tạo hoặc cập nhật file trong GitHub repository (Tạo commit lên branch chỉ định).
     *
     * @param token         Access token của GitHub
     * @param owner         Chủ sở hữu repo
     * @param repo          Tên repo
     * @param filePath      Đường dẫn file trong repository (vd: docs/architecture.md)
     * @param content       Nội dung file (plain text, hàm sẽ tự base64 encode)
     * @param commitMessage Thông điệp commit
     * @param branch        Tên branch cần push (vd: main)
     * @return Commit SHA nếu thành công
     */
    String createOrUpdateFile(String token, String owner, String repo, String filePath, String content, String commitMessage, String branch);

    /**
     * Tạo hoặc cập nhật một file trong GitHub repository bằng GitHub Contents API.
     * Tương ứng với: PUT /repos/{owner}/{repo}/contents/{path}
     *
     * @param token         Personal Access Token hoặc OAuth Token có quyền ghi repo
     * @param owner         Chủ sở hữu repo (username hoặc tổ chức)
     * @param repo          Tên repo
     * @param filePath      Đường dẫn file trong repo (vd: docs/api/UserService.md)
     * @param content       Nội dung file dạng plain text (sẽ được Base64 hóa trước khi gửi)
     * @param commitMessage Commit message
     * @param currentSha    SHA của file hiện tại trên repo (null nếu là file mới)
     * @return Kết quả publish gồm commit SHA và HTML URL
     */
    GitHubPublishResultDto putFileContent(String token, String owner, String repo,
                                          String filePath, String content,
                                          String commitMessage, String currentSha);

    /**
     * Lấy SHA hiện tại của một file trong repo (null nếu file chưa tồn tại).
     *
     * @param token    Personal Access Token hoặc OAuth Token
     * @param owner    Chủ sở hữu repo
     * @param repo     Tên repo
     * @param filePath Đường dẫn file trong repo
     * @return SHA chuỗi băm của file hiện tại hoặc null nếu file chưa tồn tại
     */
    String getCurrentFileSha(String token, String owner, String repo, String filePath);

    /**
     * Kiểm tra tính hợp lệ của GitHub token kết nối (gọi GET /user).
     *
     * @param token GitHub Personal Access Token hoặc OAuth Access Token
     * @return Kết quả kiểm tra (hợp lệ hay bị revoked/expired kèm thông báo)
     */
    com.example.livingdocs_backend.application.dto.github.GitHubTokenValidationResult validateToken(String token);
}



