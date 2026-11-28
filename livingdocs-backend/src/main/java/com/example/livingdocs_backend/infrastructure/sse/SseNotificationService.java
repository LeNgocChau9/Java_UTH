package com.example.livingdocs_backend.infrastructure.sse;

import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
public class SseNotificationService {

    private static final Long EMITTER_TIMEOUT = 30 * 60 * 1000L; // 30 phút

    private record ScopedEmitter(SseEmitter emitter, Long workspaceId, boolean globalAdmin) {}

    private final List<ScopedEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter createEmitter() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserPrincipal principal) {
            Long effectiveWs = principal.getEffectiveWorkspaceId();
            boolean globalAdmin = principal.isAdmin() && effectiveWs == null;
            return createEmitter(effectiveWs, globalAdmin);
        }
        return createEmitter(null, false);
    }

    public SseEmitter createEmitter(Long workspaceId, boolean globalAdmin) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT);
        ScopedEmitter scoped = new ScopedEmitter(emitter, workspaceId, globalAdmin);

        emitter.onCompletion(() -> {
            emitters.remove(scoped);
            log.debug("[SSE] Emitter hoàn tất, số kết nối hiện tại: {}", emitters.size());
        });

        emitter.onTimeout(() -> {
            emitters.remove(scoped);
            log.debug("[SSE] Emitter timeout, số kết nối hiện tại: {}", emitters.size());
        });

        emitter.onError(e -> {
            emitters.remove(scoped);
            log.debug("[SSE] Emitter lỗi: {}, số kết nối hiện tại: {}", e.getMessage(), emitters.size());
        });

        emitters.add(scoped);

        try {
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data("{\"status\":\"CONNECTED\"}", MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitters.remove(scoped);
        }

        return emitter;
    }

    /**
     * Backward-compatible overload: extracts workspaceId from payload map if present;
     * otherwise only delivers to globalAdmin emitters (never broadcasts cross-tenant).
     */
    public void broadcastDriftAlert(Object data) {
        Long workspaceId = null;
        if (data instanceof Map<?, ?> map) {
            Object ws = map.get("workspaceId");
            if (ws instanceof Number num) {
                workspaceId = num.longValue();
            }
        }
        broadcastDriftAlert(workspaceId, data);
    }

    public void broadcastDriftAlert(Long alertWorkspaceId, Object data) {
        log.info("[SSE Broadcast] Phát thông báo drift (workspaceId={}) trong tổng {} client kết nối...",
                alertWorkspaceId, emitters.size());
        List<ScopedEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        for (ScopedEmitter scoped : emitters) {
            boolean allowed = scoped.globalAdmin()
                    || (alertWorkspaceId != null && Objects.equals(scoped.workspaceId(), alertWorkspaceId));
            if (!allowed) {
                continue;
            }
            try {
                scoped.emitter().send(SseEmitter.event()
                        .name("drift-alert")
                        .data(data, MediaType.APPLICATION_JSON));
            } catch (Exception e) {
                deadEmitters.add(scoped);
            }
        }

        emitters.removeAll(deadEmitters);
    }
}
