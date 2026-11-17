package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.DriftAlertActionRequest;
import com.example.livingdocs_backend.application.dto.DriftAlertResponse;
import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisRequestDto;
import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisResponseDto;
import com.example.livingdocs_backend.application.dto.job.DriftAnalyzeJobPayload;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.application.service.DriftAlertService;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.sse.SseNotificationService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drift-alerts")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Drift Alerts", description = "Xử lý cảnh báo sai lệch tài liệu và ghi audit log")
public class DriftAlertController {

    private final DriftAlertService driftAlertService;
    private final SseNotificationService sseNotificationService;
    private final DocDriftDetectionServicePort docDriftDetectionService;

    @Autowired(required = false)
    private JobQueue jobQueue;

    @Autowired(required = false)
    private ObjectMapper objectMapper;

    @PostMapping("/manual-analyze")
    @Operation(
            summary = "Kích hoạt thủ công phân tích sai lệch tài liệu theo PR hoặc Tài liệu cụ thể",
            description = "Cho phép Developer hoặc Tech Lead chủ động bấm nút yêu cầu phân tích sự thay đổi và trôi dạt tài liệu. Hỗ trợ ?async=true để chạy nền và trả về jobId."
    )
    public ResponseEntity<?> triggerManualAnalyze(
            @RequestBody ManualDriftAnalysisRequestDto request,
            @RequestParam(name = "async", defaultValue = "false") boolean async,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        if (async && jobQueue != null) {
            try {
                DriftAnalyzeJobPayload payload = DriftAnalyzeJobPayload.builder()
                        .mode(request != null ? request.getMode() : null)
                        .repositoryId(request != null ? request.getRepositoryId() : null)
                        .prNumber(request != null ? request.getPrNumber() : null)
                        .documentId(request != null ? request.getDocumentId() : null)
                        .actorId(actor != null ? actor.getUserId() : null)
                        .build();
                ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
                Job job = jobQueue.enqueue(Job.TYPE_DRIFT_ANALYZE, mapper.writeValueAsString(payload));
                return ResponseEntity.accepted().body(Map.of(
                        "jobId", job.getJobId(),
                        "status", job.getStatus().name(),
                        "type", job.getType(),
                        "streamUrl", "/api/jobs/" + job.getJobId() + "/stream",
                        "message", "Đã đẩy tác vụ phân tích sai lệch tài liệu vào hàng đợi xử lý nền."
                ));
            } catch (Exception ex) {
                throw new RuntimeException("Không thể đẩy tác vụ DRIFT_ANALYZE vào hàng đợi: " + ex.getMessage(), ex);
            }
        }
        ManualDriftAnalysisResponseDto response = docDriftDetectionService.triggerManualDriftAnalysis(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Mở kết nối Server-Sent Events (SSE) để nhận cảnh báo sai lệch thời gian thực")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter streamDriftAlerts() {
        return sseNotificationService.createEmitter();
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả cảnh báo sai lệch tài liệu từ CSDL")
    public ResponseEntity<List<DocumentChangeAlertEntity>> listAll(
            @RequestParam(required = false) Long repositoryId,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(driftAlertService.findAll(repositoryId, status));
    }

    @GetMapping("/summary")
    @Operation(summary = "Lấy tổng số và danh sách cảnh báo sai lệch chưa xử lý (PENDING/OPEN) cho chuông thông báo")
    public ResponseEntity<com.example.livingdocs_backend.application.dto.DriftAlertSummaryResponse> getSummary(
            @RequestParam(required = false) Long repositoryId
    ) {
        return ResponseEntity.ok(driftAlertService.getNotificationSummary(repositoryId));
    }

    @PatchMapping("/{id}")
    @Operation(
            summary = "Cập nhật trạng thái cảnh báo drift",
            description = "IGNORE/DISMISS bỏ qua, RESOLVE đánh dấu đã giải quyết, ACCEPT chấp nhận sửa đổi, "
                    + "CHANGE_SEVERITY đổi mức độ. Chỉ Manager, Tech Lead hoặc Admin. Mỗi thao tác ghi audit log."
    )
    public ResponseEntity<DriftAlertResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody DriftAlertActionRequest request,
            @AuthenticationPrincipal UserPrincipal actor
    ) {
        return ResponseEntity.ok(driftAlertService.handle(id, request, actor));
    }
}
