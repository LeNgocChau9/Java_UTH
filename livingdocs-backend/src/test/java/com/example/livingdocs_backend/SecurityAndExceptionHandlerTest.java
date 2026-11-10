package com.example.livingdocs_backend;

import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserRepository;
import com.example.livingdocs_backend.infrastructure.security.JwtAuthenticationFilter;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import com.example.livingdocs_backend.infrastructure.web.controller.GlobalExceptionHandler;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SecurityAndExceptionHandlerTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private SpringDataUserRepository springDataUserRepository;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @Test
    @DisplayName("UserPrincipal getAuthorities trả về cả ROLE_ADMIN và ADMIN")
    void userPrincipalAuthorities_includeBothPrefixedAndRaw() {
        UserPrincipal principal = new UserPrincipal(1L, "admin@example.com", List.of("ADMIN"));
        Collection<? extends GrantedAuthority> authorities = principal.getAuthorities();

        List<String> authNames = authorities.stream().map(GrantedAuthority::getAuthority).toList();
        assertTrue(authNames.contains("ROLE_ADMIN"));
        assertTrue(authNames.contains("ADMIN"));
    }

    @Test
    @DisplayName("GlobalExceptionHandler bắt AccessDeniedException và trả về HTTP 403")
    void globalExceptionHandler_handlesAccessDeniedAs403() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        AccessDeniedException ex = new AccessDeniedException("Access Denied");

        ResponseEntity<Map<String, Object>> response = handler.handleAccessDeniedException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(403, response.getBody().get("status"));
        assertEquals("ACCESS_DENIED", response.getBody().get("errorCode"));
    }

    @Test
    @DisplayName("JwtAuthenticationFilter tự động nạp roles từ DB nếu token không chứa roles")
    void jwtFilter_fallbacksToDatabaseRoles() throws Exception {
        SecurityContextHolder.clearContext();
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtTokenProvider, springDataUserRepository);

        when(request.getHeader("Authorization")).thenReturn("Bearer sample-token");
        when(jwtTokenProvider.validateToken("sample-token")).thenReturn(true);
        when(jwtTokenProvider.getEmailFromToken("sample-token")).thenReturn("admin@example.com");
        when(jwtTokenProvider.getUserIdFromToken("sample-token")).thenReturn(1L);
        when(springDataUserRepository.findRoleNamesByUserId(1L)).thenReturn(List.of("ADMIN"));

        filter.doFilter(request, response, filterChain);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertTrue(auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));

        SecurityContextHolder.clearContext();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("GlobalExceptionHandler phân loại DataIntegrityViolationException chính xác")
    void globalExceptionHandler_handlesDataIntegrityViolation() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        // Case 1: Value too long
        var exTooLong = new org.springframework.dao.DataIntegrityViolationException("ERROR: value too long for type character varying(500)");
        var res1 = handler.handleDataIntegrityViolationException(exTooLong);
        assertEquals(HttpStatus.CONFLICT, res1.getStatusCode());
        assertTrue(res1.getBody().get("message").toString().contains("quá dài"));

        // Case 2: Unique violation
        var exUnique = new org.springframework.dao.DataIntegrityViolationException("ERROR: duplicate key value violates unique constraint 'users_email_key'");
        var res2 = handler.handleDataIntegrityViolationException(exUnique);
        assertEquals(HttpStatus.CONFLICT, res2.getStatusCode());
        assertTrue(res2.getBody().get("message").toString().contains("đã tồn tại"));
    }
}

