package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.UpdateProfileRequest;
import com.example.livingdocs_backend.application.dto.UserNotificationPreferencesDto;
import com.example.livingdocs_backend.application.dto.UserProfileResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.service.AuthServiceImpl;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.UserNotificationPreferenceEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataUserNotificationPreferenceRepository;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserProfileAndNotificationPreferencesTest {

    private UserRepositoryPort userRepositoryPort;
    private AuditServicePort auditServicePort;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider jwtTokenProvider;
    private SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private SpringDataUserNotificationPreferenceRepository notificationPreferenceRepository;
    private AuthServiceImpl authService;

    private final Map<Long, UserNotificationPreferenceEntity> prefStore = new HashMap<>();
    private User mockUser;

    @BeforeEach
    void setUp() {
        userRepositoryPort = mock(UserRepositoryPort.class);
        auditServicePort = mock(AuditServicePort.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        gitHubConnectionRepository = mock(SpringDataGitHubConnectionRepository.class);
        notificationPreferenceRepository = mock(SpringDataUserNotificationPreferenceRepository.class);

        authService = new AuthServiceImpl(
                userRepositoryPort,
                auditServicePort,
                passwordEncoder,
                jwtTokenProvider,
                gitHubConnectionRepository
        );
        authService.setNotificationPreferenceRepository(notificationPreferenceRepository);

        mockUser = User.builder()
                .userId(10L)
                .email("dev@uth.edu.vn")
                .fullName("Nguyen Van A")
                .avatarUrl("https://avatar.example/a.png")
                .passwordHash("HASHED_OLD_PASS")
                .status("ACTIVE")
                .createdAt(Instant.now())
                .build();

        when(userRepositoryPort.findByEmail("dev@uth.edu.vn")).thenReturn(Optional.of(mockUser));
        when(userRepositoryPort.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(passwordEncoder.matches("OldPass123", "HASHED_OLD_PASS")).thenReturn(true);
        when(passwordEncoder.matches(argThat(s -> !"OldPass123".equals(s)), eq("HASHED_OLD_PASS"))).thenReturn(false);
        when(passwordEncoder.encode("NewPass456")).thenReturn("HASHED_NEW_PASS");

        when(notificationPreferenceRepository.findById(anyLong()))
                .thenAnswer(inv -> Optional.ofNullable(prefStore.get(inv.<Long>getArgument(0))));
        when(notificationPreferenceRepository.save(any(UserNotificationPreferenceEntity.class)))
                .thenAnswer(inv -> {
                    UserNotificationPreferenceEntity entity = inv.getArgument(0);
                    prefStore.put(entity.getUserId(), entity);
                    return entity;
                });
    }

    @Test
    void testUpdateProfile_FullNameAndPasswordAndNotificationPreferences() {
        UserNotificationPreferencesDto prefReq = UserNotificationPreferencesDto.builder()
                .reviewEnabled(true)
                .driftAlertEnabled(false)
                .githubTokenIssueEnabled(true)
                .emailEnabled(false)
                .build();

        UpdateProfileRequest request = new UpdateProfileRequest(
                "Le Ngoc Chau",
                "https://avatar.example/chau.png",
                "OldPass123",
                "NewPass456",
                prefReq
        );

        UserProfileResponse response = authService.updateProfile("dev@uth.edu.vn", request);

        assertEquals("Le Ngoc Chau", response.getFullName());
        assertEquals("https://avatar.example/chau.png", response.getAvatarUrl());
        assertEquals("HASHED_NEW_PASS", mockUser.getPasswordHash());

        assertNotNull(response.getNotificationPreferences());
        assertTrue(response.getNotificationPreferences().getReviewEnabled());
        assertFalse(response.getNotificationPreferences().getDriftAlertEnabled());
        assertFalse(response.getNotificationPreferences().getDocumentEnabled());
        assertTrue(response.getNotificationPreferences().getGithubTokenIssueEnabled());
        assertTrue(response.getNotificationPreferences().getGithubEnabled());
        assertFalse(response.getNotificationPreferences().getEmailEnabled());

        verify(auditServicePort, atLeastOnce()).recordSecurityAction(
                eq(10L),
                eq(AuditAction.USER_UPDATED),
                eq("USER"),
                eq("10"),
                contains("fullName")
        );
    }

    @Test
    void testUpdateProfile_WrongOldPasswordThrowsException() {
        UpdateProfileRequest request = new UpdateProfileRequest(
                "Le Ngoc Chau",
                null,
                "WrongPass",
                "NewPass456",
                null
        );

        assertThrows(AuthenticationException.class, () -> authService.updateProfile("dev@uth.edu.vn", request));
        assertEquals("HASHED_OLD_PASS", mockUser.getPasswordHash());
    }

    @Test
    void testGetAndUpdateNotificationPreferences_ToggleAllChannels() {
        // Mặc định ban đầu tất cả bật (true)
        UserNotificationPreferencesDto initial = authService.getNotificationPreferences("dev@uth.edu.vn");
        assertTrue(initial.getReviewEnabled());
        assertTrue(initial.getDriftAlertEnabled());
        assertTrue(initial.getGithubTokenIssueEnabled());
        assertTrue(initial.getEmailEnabled());

        // Bật/tắt tùy chọn theo mong muốn của người dùng
        UserNotificationPreferencesDto updateReq = UserNotificationPreferencesDto.builder()
                .reviewEnabled(false)             // Tắt thông báo tài liệu mới cần duyệt
                .driftAlertEnabled(true)          // Bật thông báo cảnh báo sai lệch mã nguồn
                .githubTokenIssueEnabled(false)   // Tắt thông báo sự cố mã khóa truy cập GitHub
                .emailEnabled(true)
                .build();

        UserNotificationPreferencesDto saved = authService.updateNotificationPreferences("dev@uth.edu.vn", updateReq);

        assertFalse(saved.getReviewEnabled());
        assertTrue(saved.getDriftAlertEnabled());
        assertTrue(saved.getDocumentEnabled());
        assertFalse(saved.getGithubTokenIssueEnabled());
        assertFalse(saved.getGithubEnabled());
        assertTrue(saved.getEmailEnabled());

        // Kiểm tra đọc lại từ hệ thống
        UserNotificationPreferencesDto reloaded = authService.getNotificationPreferences("dev@uth.edu.vn");
        assertFalse(reloaded.getReviewEnabled());
        assertTrue(reloaded.getDriftAlertEnabled());
        assertFalse(reloaded.getGithubTokenIssueEnabled());

        verify(auditServicePort, times(1)).recordSecurityAction(
                eq(10L),
                eq(AuditAction.USER_UPDATED),
                eq("USER_NOTIFICATION_PREFERENCES"),
                eq("10"),
                contains("review=false")
        );
    }
}
