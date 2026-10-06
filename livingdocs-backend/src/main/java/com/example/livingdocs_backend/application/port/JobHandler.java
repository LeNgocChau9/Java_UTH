package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.domain.model.Job;

/**
 * Interface cho các bộ xử lý cụ thể của từng loại tác vụ (Job).
 */
public interface JobHandler {

    /**
     * Tên định danh của loại tác vụ mà Handler này đảm nhiệm (ví dụ: GITHUB_SYNC_REPO, TEST_FAILING_JOB).
     */
    String getJobType();

    /**
     * Logic thực thi tác vụ. Nếu ném ra Exception, Worker sẽ tự động kích hoạt cơ chế retry.
     */
    void handle(Job job) throws Exception;
}
