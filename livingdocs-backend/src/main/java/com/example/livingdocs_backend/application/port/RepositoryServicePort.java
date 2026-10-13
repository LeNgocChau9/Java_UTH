package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.github.CreateRepoRequest;
import com.example.livingdocs_backend.application.dto.github.RepoResponse;
import com.example.livingdocs_backend.application.dto.github.SyncRepoResponse;

import java.util.List;

/**
 * Port quản lý Repository và luồng đồng bộ PR / Commits từ GitHub.
 */
public interface RepositoryServicePort {

    /**
     * Thêm mới hoặc kết nối kho lưu trữ GitHub vào Workspace.
     *
     * @param request       Dữ liệu yêu cầu thêm repo
     * @param currentUserId ID người dùng thực hiện (từ JWT)
     * @return Thông tin repo đã lưu
     */
    RepoResponse addRepository(CreateRepoRequest request, Long currentUserId);

    /**
     * Đồng bộ danh sách PR và commits từ GitHub API về database cho repository chỉ định.
     *
     * @param repositoryId  ID của repository trong database
     * @param explicitToken Token ghi đè tuỳ chọn (nếu có, null nếu dùng token đã lưu)
     * @param currentUserId ID người dùng thực hiện
     * @return Kết quả thống kê số lượng PR & Commit đã đồng bộ
     */
    SyncRepoResponse syncRepository(Long repositoryId, String explicitToken, Long currentUserId);

    /**
     * Lấy danh sách repositories thuộc về một workspace.
     */
    List<RepoResponse> listRepositories(Long workspaceId);
}
