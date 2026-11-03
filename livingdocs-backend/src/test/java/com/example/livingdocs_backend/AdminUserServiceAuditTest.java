package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AdminUserServicePort;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.AdminUserServiceImpl;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PasswordResetRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPasswordResetRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceAuditTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private AuditServicePort auditServicePort;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private SpringDataPasswordResetRequestRepository passwordResetRequestRepository;

    private AdminUserServicePort adminUserService;

    @BeforeEach
    void setUp() {
        adminUserService = new AdminUserServiceImpl(
                userRepositoryPort,
                auditServicePort,
                passwordEncoder,
                passwordResetRequestRepository
        );
    }

    @Test
    @DisplayName("Gửi yêu cầu quên mật khẩu đến quyền ADMIN thành công")
    void requestPasswordReset_success() {
        User user = User.builder()
                .userId(2L)
                .email("nguyenphuccanh8533@gmail.com")
                .fullName("Nguyễn Phúc Cảnh")
                .status("ACTIVE")
                .build();

        when(userRepositoryPort.findByEmail("nguyenphuccanh8533@gmail.com")).thenReturn(Optional.of(user));
        when(passwordResetRequestRepository.findFirstByEmailAndStatusOrderByCreatedAtDesc("nguyenphuccanh8533@gmail.com", "PENDING"))
                .thenReturn(Optional.empty());

        PasswordResetRequestEntity savedEntity = PasswordResetRequestEntity.builder()
                .requestId(1L)
                .userId(2L)
                .email("nguyenphuccanh8533@gmail.com")
                .fullName("Nguyễn Phúc Cảnh")
                .status("PENDING")
                .createdAt(Instant.now())
                .build();

        when(passwordResetRequestRepository.save(any(PasswordResetRequestEntity.class))).thenReturn(savedEntity);

        ForgotPasswordRequest request = ForgotPasswordRequest.builder()
                .email("nguyenphuccanh8533@gmail.com")
                .note("Quên mật khẩu")
                .build();

        PasswordResetRequestResponse response = adminUserService.requestPasswordReset(request);

        assertNotNull(response);
        assertEquals(1L, response.getRequestId());
        assertEquals("PENDING", response.getStatus());
        assertEquals("nguyenphuccanh8533@gmail.com", response.getEmail());
        verify(passwordResetRequestRepository).save(any(PasswordResetRequestEntity.class));
    }

    @Test
    @DisplayName("Admin phê duyệt và cấp lại mật khẩu cho người dùng")
    void approvePasswordReset_success() {
        PasswordResetRequestEntity resetReq = PasswordResetRequestEntity.builder()
                .requestId(1L)
                .userId(2L)
                .email("nguyenphuccanh8533@gmail.com")
                .fullName("Nguyễn Phúc Cảnh")
                .status("PENDING")
                .createdAt(Instant.now())
                .build();

        User user = User.builder()
                .userId(2L)
                .email("nguyenphuccanh8533@gmail.com")
                .fullName("Nguyễn Phúc Cảnh")
                .passwordHash("old_hash")
                .status("ACTIVE")
                .build();

        when(passwordResetRequestRepository.findById(1L)).thenReturn(Optional.of(resetReq));
        when(userRepositoryPort.findById(2L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("Canh8533")).thenReturn("encoded_Canh8533");
        when(passwordResetRequestRepository.save(any(PasswordResetRequestEntity.class))).thenAnswer(i -> i.getArgument(0));

        AdminResetPasswordRequest request = new AdminResetPasswordRequest("Canh8533");
        PasswordResetRequestResponse response = adminUserService.approvePasswordReset(1L, request, 1L, "admin@livingdocs.dev");

        assertNotNull(response);
        assertEquals("RESOLVED", response.getStatus());
        assertEquals("Canh8533", response.getNewPasswordTemp());
        assertEquals("encoded_Canh8533", user.getPasswordHash());
        verify(userRepositoryPort).save(user);
    }
}
