package com.example.livingdocs_backend.domain.model;

/**
 * Định nghĩa các trạng thái của một công việc (Job) trong hàng đợi xử lý nền bất đồng bộ.
 * Hỗ trợ bộ mã trạng thái đặc tả (QUEUED, PROCESSING, COMPLETED, FAILED) và backward-compatibility (PENDING, RUNNING, DONE, DEAD).
 */
public enum JobStatus {
    QUEUED,      // Chờ worker quét và xử lý (tương đương PENDING)
    PENDING,     // Backward-compatibility cho QUEUED

    PROCESSING,  // Đang trong quá trình xử lý (tương đương RUNNING)
    RUNNING,     // Backward-compatibility cho PROCESSING

    COMPLETED,   // Xử lý thành công hoàn tất (tương đương DONE)
    DONE,        // Backward-compatibility cho COMPLETED

    FAILED,      // Thất bại tạm thời hoặc vĩnh viễn (DLQ)
    DEAD         // Backward-compatibility cho Dead Letter Queue (DLQ)
}
