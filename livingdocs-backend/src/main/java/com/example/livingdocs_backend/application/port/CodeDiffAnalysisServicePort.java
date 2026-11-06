package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;

import java.util.List;

/**
 * Port cho dịch vụ kéo Git Diff thời gian thực và phân tích đối chiếu AST.
 */
public interface CodeDiffAnalysisServicePort {

    /**
     * Gửi request đối chiếu AST sang AI Engine (/v1/ast/diff).
     */
    AstDiffResponseDto analyzeAstDiff(AstDiffRequestDto requestDto);

    /**
     * Gọi GitHub API thời gian thực để:
     * 1. Lấy danh sách file .java, .py, .ts bị sửa đổi trong PR.
     * 2. Lấy Base code và Head code của từng file.
     * 3. Đóng gói thành AstDiffRequestDto sẵn sàng để đối chiếu AST.
     */
    AstDiffRequestDto fetchPullRequestDiff(Long repositoryId, int prNumber);

    /**
     * Quy trình kết hợp: Kéo Git Diff thời gian thực từ GitHub và gửi sang AI
     * Engine đối chiếu AST.
     */
    AstDiffResponseDto fetchAndAnalyzePullRequestDiff(Long repositoryId, int prNumber);

    /**
     * Quy trình xử lý đối chiếu code của Pull Request:
     * - Đối chiếu AST giữa base_commit và head_commit.
     * - Trích xuất danh sách thực thể code bị ảnh hưởng.
     * - Cập nhật trạng thái code_entities.
     * - Tự động tạo DocumentChangeAlert vào CSDL.
     */
    List<DocumentChangeAlertEntity> processPullRequestCodeDiff(Long repositoryId, Long prId,
            AstDiffRequestDto requestDto);

    /**
     * Lấy danh sách các cảnh báo trôi dạt theo Repository.
     */
    List<DocumentChangeAlertEntity> getAlertsByRepository(Long repositoryId);

    /**
     * Lấy danh sách các cảnh báo trôi dạt theo PR.
     */
    List<DocumentChangeAlertEntity> getAlertsByPr(Long prId);
}
