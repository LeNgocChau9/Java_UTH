package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DriftAlertResponse;
import com.example.livingdocs_backend.application.service.DriftAlertService;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import com.example.livingdocs_backend.infrastructure.web.controller.DriftAlertController;
import com.example.livingdocs_backend.infrastructure.web.controller.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@DisplayName("HTTP /api/drift-alerts/{id}")
class DriftAlertControllerTest {

    @Mock
    private DriftAlertService driftAlertService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new DriftAlertController(driftAlertService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
    }

    @Test
    @DisplayName("PATCH trả trạng thái mới")
    void updatesAlert() throws Exception {
        when(driftAlertService.handle(eq(4L), any(), any())).thenReturn(DriftAlertResponse.builder()
                .alertId(4L)
                .status("RESOLVED")
                .severity("MEDIUM")
                .build());
        UserPrincipal actor = new UserPrincipal(1L, "m@livingdocs.local", List.of("MANAGER"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, actor.getAuthorities()));

        mockMvc.perform(patch("/api/drift-alerts/4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"RESOLVE\",\"comment\":\"đã sửa tài liệu\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alertId").value(4))
                .andExpect(jsonPath("$.status").value("RESOLVED"));
    }

    @Test
    @DisplayName("thiếu action thì 400")
    void rejectsBlankAction() throws Exception {
        mockMvc.perform(patch("/api/drift-alerts/4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Dữ liệu gửi lên không hợp lệ"));
    }

    @Test
    @DisplayName("service từ chối quyền thì 403")
    void forbidden() throws Exception {
        when(driftAlertService.handle(eq(4L), any(), any()))
                .thenThrow(new ResponseStatusException(FORBIDDEN, "Chỉ Manager, Tech Lead hoặc Admin được đóng cảnh báo hoặc đổi mức độ nghiêm trọng"));

        mockMvc.perform(patch("/api/drift-alerts/4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"IGNORE\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Chỉ Manager, Tech Lead hoặc Admin được đóng cảnh báo hoặc đổi mức độ nghiêm trọng"));
    }
}
