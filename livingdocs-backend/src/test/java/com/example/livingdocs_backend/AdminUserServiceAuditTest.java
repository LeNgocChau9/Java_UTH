package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.AdminUserServiceImpl;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminUserServiceAuditTest {

    @Test
    void recordsActorAndRoleChangeAfterChangingRole() {
        UserRepositoryPort userRepositoryPort = mock(UserRepositoryPort.class);
        AuditServicePort auditServicePort = mock(AuditServicePort.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AdminUserServiceImpl adminUserService =
                new AdminUserServiceImpl(userRepositoryPort, auditServicePort, passwordEncoder);
        User target = User.builder()
                .userId(9L)
                .email("target@example.com")
                .fullName("Target User")
                .status("ACTIVE")
                .roles(Set.of(RoleType.ROLE_DEVELOPER))
                .build();
        when(userRepositoryPort.findById(9L)).thenReturn(Optional.of(target));

        adminUserService.changeRole(9L, "MANAGER", 1L, "admin@example.com");

        verify(userRepositoryPort).changeRole(9L, "MANAGER");
        verify(auditServicePort).recordRoleChange(
                1L, "admin@example.com", 9L, "ROLE_DEVELOPER", "MANAGER");
    }

    @Test
    void adminCanCreateUserSuccessfully() {
        UserRepositoryPort userRepositoryPort = mock(UserRepositoryPort.class);
        AuditServicePort auditServicePort = mock(AuditServicePort.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode("Secret@123")).thenReturn("hashedSecret");

        AdminUserServiceImpl adminUserService =
                new AdminUserServiceImpl(userRepositoryPort, auditServicePort, passwordEncoder);

        when(userRepositoryPort.existsByEmail("dev_staff@example.com")).thenReturn(false);

        User savedUser = User.builder()
                .userId(15L)
                .email("dev_staff@example.com")
                .fullName("Staff User")
                .status("ACTIVE")
                .roles(Set.of(RoleType.ROLE_STAFF))
                .build();
        when(userRepositoryPort.save(any(User.class))).thenReturn(savedUser);
        when(userRepositoryPort.findById(15L)).thenReturn(Optional.of(savedUser));

        com.example.livingdocs_backend.application.dto.AdminCreateUserRequest req =
                com.example.livingdocs_backend.application.dto.AdminCreateUserRequest.builder()
                        .email("dev_staff@example.com")
                        .password("Secret@123")
                        .fullName("Staff User")
                        .role("STAFF")
                        .build();

        var res = adminUserService.createUser(req, 1L, "admin@example.com");

        assertNotNull(res);
        assertEquals(15L, res.getUserId());
        assertEquals("dev_staff@example.com", res.getEmail());
        assertTrue(res.getRoles().contains("ROLE_STAFF"));
        verify(userRepositoryPort).changeRole(15L, "STAFF");
        verify(auditServicePort).recordSecurityAction(eq(1L), any(), eq("USER"), eq("15"), contains("dev_staff@example.com"));
    }
}
