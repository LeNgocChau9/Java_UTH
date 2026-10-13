package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.AdminUserServiceImpl;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static org.mockito.Mockito.*;

class AdminUserServiceAuditTest {

    @Test
    void recordsActorAndRoleChangeAfterChangingRole() {
        UserRepositoryPort userRepositoryPort = mock(UserRepositoryPort.class);
        AuditServicePort auditServicePort = mock(AuditServicePort.class);
        AdminUserServiceImpl adminUserService =
                new AdminUserServiceImpl(userRepositoryPort, auditServicePort);
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
}
