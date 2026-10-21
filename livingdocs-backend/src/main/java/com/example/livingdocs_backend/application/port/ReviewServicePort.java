package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ManagerActionRequest;
import com.example.livingdocs_backend.application.dto.ReviewActionResponse;
import com.example.livingdocs_backend.application.dto.ReviewQueueItemResponse;
import com.example.livingdocs_backend.application.dto.StaffActionRequest;

import java.util.List;

/**
 * Use Case Service Port (Inbound Port) cho Hàng đợi rà soát của Staff và phê duyệt của Manager.
 * Clean Architecture Application Layer.
 */
public interface ReviewServicePort {

    /**
     * Lấy danh sách tài liệu đang chờ Staff rà soát kèm thông tin tác giả và repo (GET /api/reviews/staff/queue).
     */
    List<ReviewQueueItemResponse> getStaffQueue();

    /**
     * Xử lý hành động của Staff: Duyệt kèm ghi chú hoặc Từ chối (POST /api/reviews/{id}/staff-action).
     */
    ReviewActionResponse handleStaffAction(Long id, StaffActionRequest request, Long actorId, String actorRole, String actorEmail);

    /**
     * Lấy danh sách tài liệu chờ Manager ký duyệt cuối cùng (GET /api/reviews/manager/queue).
     */
    List<ReviewQueueItemResponse> getManagerQueue();

    /**
     * Xử lý hành động của Manager: Phê duyệt xuất bản hoặc Trả về (POST /api/reviews/{id}/manager-action).
     */
    ReviewActionResponse handleManagerAction(Long id, ManagerActionRequest request, Long actorId, String actorRole, String actorEmail);
}
