package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ChangelogResponse;
import com.example.livingdocs_backend.application.dto.PageResponse;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.infrastructure.web.controller.ChangelogController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChangelogControllerTest {

        private ChangelogServicePort changelogServicePort;
        private ChangelogController changelogController;

        @BeforeEach
        void setUp() {
                changelogServicePort = mock(ChangelogServicePort.class);
                changelogController = new ChangelogController(changelogServicePort);
        }

        @Test
        @DisplayName("Lọc changelogs toàn hệ thống có phân trang và lọc theo actorRole, repoId, khoảng ngày")
        void testGetChangelogs_withFilterAndPagination() {
                ChangelogResponse item = ChangelogResponse.builder()
                                .id(1L)
                                .documentId(10L)
                                .documentTitle("Tài liệu Kiến trúc")
                                .repoId(1L)
                                .versionId(1L)
                                .actorId(2L)
                                .actorRole("STAFF")
                                .changeSummary("Staff phê duyệt tài liệu")
                                .createdAt(Instant.now())
                                .build();

                PageResponse<ChangelogResponse> pageResponse = PageResponse.<ChangelogResponse>builder()
                                .content(List.of(item))
                                .page(0)
                                .size(20)
                                .totalElements(1L)
                                .totalPages(1)
                                .first(true)
                                .last(true)
                                .build();

                when(changelogServicePort.getFilteredChangelogs(eq("STAFF"), eq(1L), any(), any(), any(Pageable.class)))
                                .thenReturn(pageResponse);

                ResponseEntity<PageResponse<ChangelogResponse>> response = changelogController.getChangelogs(
                                "STAFF",
                                1L,
                                LocalDate.of(2026, 10, 1),
                                LocalDate.of(2026, 10, 30),
                                0,
                                20);

                assertNotNull(response);
                assertEquals(200, response.getStatusCode().value());
                assertNotNull(response.getBody());
                assertEquals(1, response.getBody().getContent().size());
                assertEquals("STAFF", response.getBody().getContent().get(0).getActorRole());
                assertEquals(1L, response.getBody().getContent().get(0).getRepoId());

                verify(changelogServicePort, times(1)).getFilteredChangelogs(
                                eq("STAFF"),
                                eq(1L),
                                any(Instant.class),
                                any(Instant.class),
                                any(Pageable.class));
        }
}
