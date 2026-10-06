package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Handler giả lập lỗi phục vụ kiểm thử (Testing / Demo) cơ chế Retry 3 lần và Dead Letter Queue.
 */
@Slf4j
@Component
public class FailingTestJobHandler implements JobHandler {

    public static final String JOB_TYPE = "TEST_FAILING_JOB";

    @Override
    public String getJobType() {
        return JOB_TYPE;
    }

    @Override
    public void handle(Job job) throws Exception {
        log.warn("[FailingTestJobHandler] Simulating failure for job #{} (Attempt {}/{})", 
                job.getJobId(), job.getAttempts(), job.getMaxAttempts());
        
        // Giả lập lỗi ném ra ngoại lệ
        throw new RuntimeException("Simulated connection timeout to remote service on attempt #" + job.getAttempts());
    }
}
