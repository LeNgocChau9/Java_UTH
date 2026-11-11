package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;
import com.example.livingdocs_backend.application.dto.drift.PrDriftScanJobPayload;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.application.service.GitHubWebhookServiceImpl;
import com.example.livingdocs_backend.domain.model.Job;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Worker JobHandler xử lý quét sai lệch tài liệu (Drift Scan) ngầm
 * khi nhận được sự kiện Pull Request từ GitHub Webhook.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PullRequestDriftScanJobHandler implements JobHandler {

    private final DocDriftDetectionServicePort docDriftDetectionService;
    private final PrMergeBlockingServicePort prMergeBlockingService;
    private final ObjectMapper objectMapper;

    @Override
    public String getJobType() {
        return GitHubWebhookServiceImpl.JOB_TYPE_PR_DRIFT_SCAN;
    }

    @Override
    public void handle(Job job) throws Exception {
        log.info("[JobHandler - PR_DRIFT_SCAN] Bắt đầu xử lý Job #{}", job.getJobId());

        if (job.getPayloadJson() == null || job.getPayloadJson().isBlank()) {
            log.warn("[JobHandler - PR_DRIFT_SCAN] Payload của Job #{} rỗng, bỏ qua.", job.getJobId());
            return;
        }

        PrDriftScanJobPayload payload = objectMapper.readValue(job.getPayloadJson(), PrDriftScanJobPayload.class);
        log.info("[JobHandler - PR_DRIFT_SCAN] Quét Drift cho PR #{} tại repo [{}] (Base: {}, Head: {})",
                payload.getPrNumber(), payload.getRepoFullName(), payload.getBaseCommitHash(),
                payload.getHeadCommitHash());

        // Kích hoạt dịch vụ phát hiện sai lệch tài liệu: tự động kéo Diff từ GitHub và
        // đối chiếu AST
        try {
            PrDriftAnalysisResultDto result = docDriftDetectionService.detectDriftAndCommentOnPr(
                    payload.getRepositoryId(),
                    payload.getPrNumber());

            log.info(
                    "[JobHandler - PR_DRIFT_SCAN] Hoàn thành quét Drift cho PR #{}: Tìm thấy {} tài liệu lệch, Đã lưu {} thay đổi, Comment ID: {}",
                    payload.getPrNumber(),
                    result != null ? result.totalAffectedDocs() : 0,
                    result != null ? result.totalChangesDetected() : 0,
                    result != null && result.commentId() != null ? result.commentId() : "Không");

            // Kích hoạt cơ chế kiểm tra và gửi trạng thái Chặn Hợp nhất PR (GitHub Checks / Statuses API)
            try {
                if (prMergeBlockingService != null) {
                    prMergeBlockingService.evaluateAndSendPrCheck(
                            payload.getRepositoryId(),
                            payload.getPrNumber(),
                            payload.getHeadCommitHash()
                    );
                }
            } catch (Exception checkEx) {
                log.warn("[JobHandler - PR_DRIFT_SCAN] Không thể gửi GitHub Check Run cho PR #{}: {}",
                        payload.getPrNumber(), checkEx.getMessage());
            }
        } catch (Exception ex) {
            log.error("[JobHandler - PR_DRIFT_SCAN] Lỗi khi thực thi phát hiện sai lệch cho PR #{}: {}",
                    payload.getPrNumber(), ex.getMessage(), ex);
            throw ex; // Ném lại để JobWorker ghi nhận lỗi và kích hoạt cơ chế retry nếu cần
        }
    }
}
