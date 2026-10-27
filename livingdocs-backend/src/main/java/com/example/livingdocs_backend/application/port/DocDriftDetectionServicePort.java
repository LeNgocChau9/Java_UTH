package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;

import java.util.List;

public interface DocDriftDetectionServicePort {

    /**
     * Thuật toán tìm các tài liệu bị ảnh hưởng thông qua bảng doc_code_links
     * dựa trên danh sách các hàm/class Java bị sửa, xóa, đổi tên từ Pull Request.
     */
    List<AffectedDocumentResultDto> findAffectedDocuments(Long repositoryId, AstDiffRequestDto diffRequest);

    /**
     * Quy trình hoàn chỉnh:
     * 1. Đối chiếu AST code giữa base và head của Pull Request.
     * 2. Truy vấn doc_code_links xác định tài liệu bị ảnh hưởng.
     * 3. Lưu bản ghi cảnh báo vào bảng document_change_alerts (drift_alerts) với mức độ tương ứng.
     * 4. Gọi GitHub REST API đăng comment cảnh báo chi tiết trực tiếp lên Pull Request.
     */
    PrDriftAnalysisResultDto detectDriftAndCommentOnPr(Long repositoryId, int prNumber, AstDiffRequestDto diffRequest);
}
