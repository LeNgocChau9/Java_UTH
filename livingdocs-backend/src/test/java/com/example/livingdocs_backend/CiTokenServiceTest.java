package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.example.livingdocs_backend.application.dto.CreateCiTokenRequest;
import com.example.livingdocs_backend.application.dto.CreatedCiTokenResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.CiTokenRepositoryPort;
import com.example.livingdocs_backend.application.service.CiTokenServiceImpl;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;

class CiTokenServiceTest {

        private CiTokenRepositoryPort ciTokenRepositoryPort;
        private UserRepositoryPort userRepositoryPort;
        private SpringDataRepositoryRepository springDataRepositoryRepository;
        private AuditServicePort auditServicePort;
        private CiTokenServiceImpl ciTokenService;

        @BeforeEach
        void setUp() {
                ciTokenRepositoryPort = mock(CiTokenRepositoryPort.class);
                userRepositoryPort = mock(UserRepositoryPort.class);
                springDataRepositoryRepository = mock(SpringDataRepositoryRepository.class);
                auditServicePort = mock(AuditServicePort.class);
                ciTokenService = new CiTokenServiceImpl(
                                ciTokenRepositoryPort,
                                userRepositoryPort,
                                springDataRepositoryRepository,
                                auditServicePort);

                when(userRepositoryPort.findById(1L)).thenReturn(Optional.of(
                                User.builder().userId(1L).email("admin@livingdocs.com").fullName("System Admin")
                                                .build()));
        }

        @Test
        void createToken_generatesValidTokenAndRecordsAudit() {
                CreateCiTokenRequest request = CreateCiTokenRequest.builder()
                                .tokenName("GitHub Actions Main")
                                .repositoryId(10L)
                                .description("CI token for main repo")
                                .expiresInDays(30)
                                .build();

                when(ciTokenRepositoryPort.save(any(CiToken.class))).thenAnswer(invocation -> {
                        CiToken input = invocation.getArgument(0);
                        input.setTokenId(99L);
                        return input;
                });

                CreatedCiTokenResponse response = ciTokenService.createToken(request, 1L);

                assertNotNull(response);
                assertEquals(99L, response.getTokenId());
                assertTrue(response.getToken().startsWith("lvd_ci_"));
                assertEquals(response.getToken().substring(0, 14), response.getTokenPrefix());
                assertNotNull(response.getExpiresAt());

                verify(ciTokenRepositoryPort).save(any(CiToken.class));
                verify(auditServicePort).recordSecurityAction(
                                eq(1L),
                                eq(AuditAction.CI_TOKEN_CREATED),
                                eq("CiToken"),
                                eq("99"),
                                anyString());
        }

        @Test
        void revokeToken_successfullyRevokesAndLogsAudit() {
                CiToken existing = CiToken.builder()
                                .tokenId(99L)
                                .tokenName("GitHub Actions Main")
                                .tokenPrefix("lvd_ci_12345678")
                                .isRevoked(false)
                                .build();

                when(ciTokenRepositoryPort.findById(99L)).thenReturn(Optional.of(existing));

                ciTokenService.revokeToken(99L, 1L);

                verify(ciTokenRepositoryPort).revokeToken(99L);
                verify(auditServicePort).recordSecurityAction(
                                eq(1L),
                                eq(AuditAction.CI_TOKEN_REVOKED),
                                eq("CiToken"),
                                eq("99"),
                                anyString());
        }

        @Test
        void validateAndTouchToken_returnsEmptyWhenTokenIsRevoked() {
                when(ciTokenRepositoryPort.findByTokenHash(anyString())).thenReturn(Optional.of(
                                CiToken.builder()
                                                .tokenId(99L)
                                                .tokenPrefix("lvd_ci_test")
                                                .isRevoked(true)
                                                .build()));

                Optional<CiToken> result = ciTokenService
                                .validateAndTouchToken("lvd_ci_abcdef1234567890abcdef1234567890");

                assertTrue(result.isEmpty());
        }
}
