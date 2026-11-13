package com.example.livingdocs_backend.infrastructure.sse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
public class SseNotificationService {

    private static final Long EMITTER_TIMEOUT = 30 * 60 * 1000L; // 30 phút
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter createEmitter() {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT);

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            log.debug("[SSE] Emitter hoàn tất, số kết nối hiện tại: {}", emitters.size());
        });

        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            log.debug("[SSE] Emitter timeout, số kết nối hiện tại: {}", emitters.size());
        });

        emitter.onError(e -> {
            emitters.remove(emitter);
            log.debug("[SSE] Emitter lỗi: {}, số kết nối hiện tại: {}", e.getMessage(), emitters.size());
        });

        emitters.add(emitter);

        try {
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data("{\"status\":\"CONNECTED\"}", MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    public void broadcastDriftAlert(Object data) {
        log.info("[SSE Broadcast] Đang phát thông báo tới {} client kết nối...", emitters.size());
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("drift-alert")
                        .data(data, MediaType.APPLICATION_JSON));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }

        emitters.removeAll(deadEmitters);
    }
}
