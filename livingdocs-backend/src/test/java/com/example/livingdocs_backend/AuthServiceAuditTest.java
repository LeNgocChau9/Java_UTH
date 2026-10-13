package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.LoginRequest;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.AuthServiceImpl;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuthServiceAuditTest {

    private UserRepositoryPort userRepositoryPort;
    private AuditServicePort auditServicePort;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider jwtTokenProvider;
    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        userRepositoryPort = mock(UserRepositoryPort.class);
        auditServicePort = mock(AuditServicePort.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        authService = new AuthServiceImpl(
                userRepositoryPort, auditServicePort, passwordEncoder, jwtTokenProvider);
    }

    @Test
    void recordsSuccessfulLogin() {
        User user = User.builder()
                .userId(7L)
                .email("user@example.com")
                .passwordHash("hash")
                .fullName("Test User")
                .status("ACTIVE")
                .roles(Set.of(RoleType.ROLE_DEVELOPER))
                .build();
        when(userRepositoryPort.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret", "hash")).thenReturn(true);
        when(jwtTokenProvider.generateToken(eq(7L), eq("user@example.com"), anyCollection()))
                .thenReturn("token");
        when(jwtTokenProvider.getExpirationSeconds()).thenReturn(3600L);

        authService.login(LoginRequest.builder()
                .email("User@Example.com")
                .password("secret")
                .build());

        verify(auditServicePort).recordLogin(7L, "user@example.com", true);
    }

    @Test
    void recordsFailedLoginBeforeRejectingInvalidCredentials() {
        when(userRepositoryPort.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThrows(AuthenticationException.class, () -> authService.login(LoginRequest.builder()
                .email("unknown@example.com")
                .password("secret")
                .build()));

        verify(auditServicePort).recordLogin(null, "unknown@example.com", false);
    }
}
