package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.domain.model.CodeEntity;

import java.util.List;

/**
 * Port cho dịch vụ bóc tách và lập chỉ mục mã nguồn (CodeIndexService).
 */
public interface CodeIndexServicePort {

    /**
     * Bóc tách AST của một file mã nguồn và lưu danh sách entities vào CSDL.
     *
     * @param repositoryId ID của kho lưu trữ trong hệ thống
     * @param filePath     Đường dẫn file (vd: src/com/example/demo/OrderController.java)
     * @param sourceCode   Mã nguồn Java của file
     * @param commitHash   Commit hash hiện tại của file
     * @return Danh sách các CodeEntity đã được lưu vào database
     */
    List<CodeEntity> indexFile(Long repositoryId, String filePath, String sourceCode, String commitHash);

    /**
     * Lấy danh sách entities của toàn bộ kho lưu trữ.
     */
    List<CodeEntity> getEntitiesByRepository(Long repositoryId);

    /**
     * Lấy danh sách entities của một file cụ thể.
     */
    List<CodeEntity> getEntitiesByFile(Long repositoryId, String filePath);

    /**
     * Trực tiếp gọi AI Engine để bóc tách AST mà không bắt buộc lưu (dùng để preview).
     */
    AstExtractResponseDto extractAstRaw(Long repositoryId, String filePath, String sourceCode, String commitHash);

    /**
     * Tính toán tỷ lệ bao phủ tài liệu (% Coverage) cho toàn bộ repository.
     */
    DocCoverageResponseDto calculateRepositoryCoverage(Long repositoryId);

    /**
     * Tính toán tỷ lệ bao phủ tài liệu (% Coverage) cho một file cụ thể trong repository.
     */
    DocCoverageResponseDto calculateFileCoverage(Long repositoryId, String filePath);
}
