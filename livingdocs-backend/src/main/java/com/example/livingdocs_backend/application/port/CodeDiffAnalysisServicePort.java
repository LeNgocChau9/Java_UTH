package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;

import java.util.List;

public interface CodeDiffAnalysisServicePort {

    /**
     * Gửi request đối chiếu AST sang AI Engine.
     */
    AstDiffResponseDto analyzeAstDiff(AstDiffRequestDto requestDto);

    /**
     * Quy trình xử lý đối chiếu code của Pull Request:
     * - Đối chiếu AST giữa base_commit và head_commit.
     * - Trích xuất danh sách thực thể code bị ảnh hưởng.
     * - Cập nhật trạng thái code_entities.
     * - Tự động tạo DocumentChangeAlert vào CSDL.
     */
    List<DocumentChangeAlertEntity> processPullRequestCodeDiff(Long repositoryId, Long prId, AstDiffRequestDto requestDto);

    /**
     * Lấy danh sách các cảnh báo trôi dạt theo Repository.
     */
    List<DocumentChangeAlertEntity> getAlertsByRepository(Long repositoryId);

    /**
     * Lấy danh sách các cảnh báo trôi dạt theo PR.
     */
    List<DocumentChangeAlertEntity> getAlertsByPr(Long prId);
}
