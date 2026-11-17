package com.example.livingdocs_backend.infrastructure.sse;

import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Dịch vụ quản lý kết nối Server-Sent Events (SSE) theo từng jobId.
 * Phát trạng thái tiến trình thực tế: FETCHING_REPO -> EXTRACTING_AST -> RAG_CONTEXT -> LLM_GENERATING -> COMPLETED / FAILED.
 */
@Slf4j
@Service
public class JobStreamService {

    private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L; // 30 phút
    private static final int MAX_CACHED_EVENTS = 1000;
    private static final int LOCK_STRIPES = 256;

    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<SseEmitter>> jobEmitters = new ConcurrentHashMap<>();
    private final Object[] jobLocks = new Object[LOCK_STRIPES];
    private final Map<Long, JobProgressEvent> latestEvents = Collections.synchronizedMap(
            new LinkedHashMap<Long, JobProgressEvent>(MAX_CACHED_EVENTS, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<Long, JobProgressEvent> eldest) {
                    return size() > MAX_CACHED_EVENTS;
                }
            }
    );

    {
        for (int i = 0; i < LOCK_STRIPES; i++) {
            jobLocks[i] = new Object();
        }
    }

    @Autowired(required = false)
    private ObjectMapper objectMapper;

    public record JobProgressEvent(
            Long jobId,
            String state,
            int progress,
            String message,
            Object payload
    ) {}

    private Object lockFor(Long jobId) {
        int idx = Math.floorMod(Long.hashCode(jobId), LOCK_STRIPES);
        return jobLocks[idx];
    }

    public SseEmitter registerEmitter(Long jobId) {
        return registerEmitter(jobId, null);
    }

    public SseEmitter registerEmitter(Long jobId, Job existingJob) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        if (jobId == null) {
            emitter.complete();
            return emitter;
        }

        Runnable cleanup = () -> removeEmitter(jobId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(() -> {
            log.debug("[JobSSE] Emitter timeout cho job #{}", jobId);
            cleanup.run();
        });
        emitter.onError(ex -> {
            log.debug("[JobSSE] Emitter lỗi cho job #{}: {}", jobId, ex.getMessage());
            cleanup.run();
        });

        synchronized (lockFor(jobId)) {
            JobProgressEvent cached = latestEvents.get(jobId);

            boolean dbCompleted = existingJob != null
                    && (existingJob.getStatus() == JobStatus.COMPLETED || existingJob.getStatus() == JobStatus.DONE);
            boolean dbFailed = existingJob != null
                    && (existingJob.getStatus() == JobStatus.FAILED || existingJob.getStatus() == JobStatus.DEAD);
            boolean dbActive = existingJob != null && !dbCompleted && !dbFailed;

            try {
                if (dbCompleted) {
                    JobProgressEvent doneEvent = (cached != null && "COMPLETED".equalsIgnoreCase(cached.state()))
                            ? cached
                            : new JobProgressEvent(
                                    jobId,
                                    "COMPLETED",
                                    100,
                                    "Tác vụ đã hoàn tất thành công.",
                                    tryParseJson(existingJob.getResultJson())
                            );
                    emitter.send(SseEmitter.event().data(doneEvent, MediaType.APPLICATION_JSON));
                    emitter.complete();
                    return emitter;
                }

                if (dbFailed) {
                    JobProgressEvent failedEvent = (cached != null && "FAILED".equalsIgnoreCase(cached.state()))
                            ? cached
                            : new JobProgressEvent(
                                    jobId,
                                    "FAILED",
                                    0,
                                    existingJob.getLastError() != null ? existingJob.getLastError() : "Tác vụ đã thất bại.",
                                    Map.of(
                                            "status", existingJob.getStatus().name(),
                                            "attempts", existingJob.getAttempts() != null ? existingJob.getAttempts() : 0,
                                            "maxAttempts", existingJob.getMaxAttempts() != null ? existingJob.getMaxAttempts() : 3,
                                            "isTerminal", true,
                                            "lastError", existingJob.getLastError() != null ? existingJob.getLastError() : ""
                                    )
                            );
                    emitter.send(SseEmitter.event().data(failedEvent, MediaType.APPLICATION_JSON));
                    emitter.complete();
                    return emitter;
                }

                if (cached != null && (!dbActive || !isTerminalState(cached.state()))) {
                    emitter.send(SseEmitter.event().data(cached, MediaType.APPLICATION_JSON));
                    if (isTerminalState(cached.state())) {
                        emitter.complete();
                        return emitter;
                    }
                } else {
                    String initialState = existingJob != null && existingJob.getStatus() != null
                            ? existingJob.getStatus().name()
                            : "QUEUED";
                    JobProgressEvent initEvent = new JobProgressEvent(
                            jobId,
                            initialState,
                            5,
                            "Đang chờ worker tiếp nhận tác vụ #" + jobId + "...",
                            null
                    );
                    emitter.send(SseEmitter.event().data(initEvent, MediaType.APPLICATION_JSON));
                }

                CopyOnWriteArrayList<SseEmitter> list = jobEmitters.computeIfAbsent(jobId, k -> new CopyOnWriteArrayList<>());
                synchronized (list) {
                    list.add(emitter);
                }
            } catch (Exception e) {
                log.debug("[JobSSE] Không thể gửi event khởi tạo cho job #{}: {}", jobId, e.getMessage());
                cleanup.run();
            }
        }

        return emitter;
    }

    public void publishProgress(Long jobId, String state, int progressPercent, String message, Object payload) {
        if (jobId == null) {
            return;
        }

        JobProgressEvent event = new JobProgressEvent(jobId, state, progressPercent, message, payload);
        boolean terminal = isTerminalState(state);

        synchronized (lockFor(jobId)) {
            JobProgressEvent previous = latestEvents.get(jobId);
            if (previous != null && isTerminalState(previous.state()) && !terminal) {
                log.debug("[JobSSE] Bỏ qua event '{}' cho job #{} vì đã ở trạng thái kết thúc '{}'",
                        state, jobId, previous.state());
                return;
            }

            latestEvents.put(jobId, event);

            CopyOnWriteArrayList<SseEmitter> emitters = jobEmitters.get(jobId);
            if (emitters == null) {
                return;
            }

            synchronized (emitters) {
                if (emitters.isEmpty()) {
                    jobEmitters.remove(jobId, emitters);
                    return;
                }

                List<SseEmitter> deadEmitters = new ArrayList<>();
                for (SseEmitter emitter : emitters) {
                    try {
                        emitter.send(SseEmitter.event().data(event, MediaType.APPLICATION_JSON));
                        if (terminal) {
                            emitter.complete();
                            deadEmitters.add(emitter);
                        }
                    } catch (Exception e) {
                        deadEmitters.add(emitter);
                    }
                }

                if (!deadEmitters.isEmpty()) {
                    emitters.removeAll(deadEmitters);
                    if (emitters.isEmpty()) {
                        jobEmitters.remove(jobId, emitters);
                    }
                }
            }
        }
    }

    public void clearJobState(Long jobId) {
        if (jobId != null) {
            synchronized (lockFor(jobId)) {
                latestEvents.remove(jobId);
            }
        }
    }

    public JobProgressEvent getLatestEvent(Long jobId) {
        return jobId != null ? latestEvents.get(jobId) : null;
    }

    private void removeEmitter(Long jobId, SseEmitter emitter) {
        if (jobId == null || emitter == null) {
            return;
        }
        synchronized (lockFor(jobId)) {
            CopyOnWriteArrayList<SseEmitter> emitters = jobEmitters.get(jobId);
            if (emitters != null) {
                synchronized (emitters) {
                    emitters.remove(emitter);
                    if (emitters.isEmpty()) {
                        jobEmitters.remove(jobId, emitters);
                    }
                }
            }
        }
    }

    private boolean isTerminalState(String state) {
        return "COMPLETED".equalsIgnoreCase(state) || "FAILED".equalsIgnoreCase(state);
    }

    private Object tryParseJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        if (objectMapper != null) {
            try {
                return objectMapper.readValue(json, Object.class);
            } catch (Exception ignored) {
                return json;
            }
        }
        return json;
    }
}
