package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DashboardStatsResponse;
import com.example.livingdocs_backend.application.dto.DashboardTrendPoint;
import com.example.livingdocs_backend.application.dto.DashboardTrendResponse;
import com.example.livingdocs_backend.application.service.DashboardStatsService;
import com.example.livingdocs_backend.infrastructure.web.controller.DashboardController;
import com.example.livingdocs_backend.infrastructure.web.controller.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@DisplayName("HTTP /api/dashboard/stats")
class DashboardControllerTest {

    @Mock
    private DashboardStatsService dashboardStatsService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mockMvc = MockMvcBuilders.standaloneSetup(new DashboardController(dashboardStatsService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper))
                .build();
    }

    @Test
    @DisplayName("GET /api/dashboard/stats trả các chỉ số sức khỏe")
    void returnsStats() throws Exception {
        Map<String, Long> alerts = new LinkedHashMap<>();
        alerts.put("LOW", 0L);
        alerts.put("MEDIUM", 2L);
        alerts.put("HIGH", 1L);
        alerts.put("CRITICAL", 0L);
        when(dashboardStatsService.getStats(null)).thenReturn(DashboardStatsResponse.builder()
                .totalClassesAndFunctions(10)
                .documentedEntities(4)
                .coveragePercent(40.0)
                .freshnessPercent(50.0)
                .totalDocuments(2)
                .freshDocuments(1)
                .openDriftAlerts(3)
                .openAlertsBySeverity(alerts)
                .build());

        mockMvc.perform(get("/api/dashboard/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalClassesAndFunctions").value(10))
                .andExpect(jsonPath("$.documentedEntities").value(4))
                .andExpect(jsonPath("$.coveragePercent").value(40.0))
                .andExpect(jsonPath("$.freshnessPercent").value(50.0))
                .andExpect(jsonPath("$.openDriftAlerts").value(3))
                .andExpect(jsonPath("$.openAlertsBySeverity.MEDIUM").value(2))
                .andExpect(jsonPath("$.openAlertsBySeverity.HIGH").value(1));
    }

    @Test
    @DisplayName("GET /api/dashboard/stats?repositoryId=2 lọc theo kho")
    void filtersByRepository() throws Exception {
        when(dashboardStatsService.getStats(2L)).thenReturn(DashboardStatsResponse.builder()
                .repositoryId(2L)
                .totalClassesAndFunctions(1)
                .coveragePercent(0.0)
                .freshnessPercent(0.0)
                .openAlertsBySeverity(Map.of("LOW", 0L))
                .build());

        mockMvc.perform(get("/api/dashboard/stats").param("repositoryId", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositoryId").value(2));

        verify(dashboardStatsService).getStats(2L);
    }

    @Test
    @DisplayName("repositoryId không dương trả 400")
    void rejectsNonPositiveRepositoryId() throws Exception {
        mockMvc.perform(get("/api/dashboard/stats").param("repositoryId", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("repositoryId phải là số dương"));

        mockMvc.perform(get("/api/dashboard/stats").param("repositoryId", "-3"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("repositoryId phải là số dương"));
    }

    @Test
    @DisplayName("GET /api/dashboard/trend trả chuỗi tuần")
    void returnsTrend() throws Exception {
        when(dashboardStatsService.getTrend(null, 12)).thenReturn(DashboardTrendResponse.builder()
                .weeks(12)
                .points(List.of(DashboardTrendPoint.builder()
                        .weekStart(LocalDate.of(2026, 10, 26))
                        .createdDocuments(2)
                        .updates(1)
                        .alerts(0)
                        .build()))
                .build());

        mockMvc.perform(get("/api/dashboard/trend"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks").value(12))
                .andExpect(jsonPath("$.points[0].weekStart").value("2026-10-26"))
                .andExpect(jsonPath("$.points[0].createdDocuments").value(2))
                .andExpect(jsonPath("$.points[0].updates").value(1))
                .andExpect(jsonPath("$.points[0].alerts").value(0));
    }

    @Test
    @DisplayName("weeks ngoài khoảng trả 400")
    void rejectsTrendWeeks() throws Exception {
        when(dashboardStatsService.getTrend(null, 0))
                .thenThrow(new IllegalArgumentException("weeks phải từ 1 đến 52"));

        mockMvc.perform(get("/api/dashboard/trend").param("weeks", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("weeks phải từ 1 đến 52"));
    }

    @Test
    @DisplayName("repositoryId không phải số trả 400")
    void rejectsNonNumericRepositoryId() throws Exception {
        mockMvc.perform(get("/api/dashboard/stats").param("repositoryId", "abc"))
                .andExpect(status().isBadRequest());
    }
}
