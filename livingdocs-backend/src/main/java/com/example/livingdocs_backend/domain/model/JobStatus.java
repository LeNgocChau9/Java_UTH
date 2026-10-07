package com.example.livingdocs_backend.domain.model;

/**
 * Định nghĩa các trạng thái của một công việc (Job) trong hàng đợi.
 */
public enum JobStatus {
    PENDING,   // Chờ worker quét và xử lý
    RUNNING,   // Đang trong quá trình xử lý
    DONE,      // Xử lý thành công
    FAILED,    // Tạm thời thất bại, còn lượt thử lại
    DEAD       // Thất bại quá số lần tối đa, chuyển vào Dead Letter Queue (DLQ)
}
