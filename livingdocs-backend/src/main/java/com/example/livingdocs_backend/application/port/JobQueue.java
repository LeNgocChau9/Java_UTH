package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.domain.model.Job;

/**
 * Interface để các thành phần nghiệp vụ đẩy tác vụ vào hàng đợi bất đồng bộ.
 */
public interface JobQueue {

    /**
     * Đẩy một công việc mới vào hàng đợi với số lần thử tối đa mặc định (3 lần).
     */
    Job enqueue(String type, String payloadJson);

    /**
     * Đẩy một công việc mới vào hàng đợi với số lần thử tùy chỉnh.
     */
    Job enqueue(String type, String payloadJson, int maxAttempts);
}
