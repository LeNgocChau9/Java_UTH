package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.CiTokenResponse;
import com.example.livingdocs_backend.application.dto.CreateCiTokenRequest;
import com.example.livingdocs_backend.application.dto.CreatedCiTokenResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.CiTokenRepositoryPort;
import com.example.livingdocs_backend.application.port.CiTokenServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CiTokenServiceImpl implements CiTokenServicePort {

    private final CiTokenRepositoryPort ciTokenRepositoryPort;
    private final UserRepositoryPort userRepositoryPort;
    private final SpringDataRepositoryRepository springDataRepositoryRepository;
    private final AuditServicePort auditServicePort;

    private static final String TOKEN_PREFIX = "lvd_ci_";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Override
    @Transactional
    public CreatedCiTokenResponse createToken(CreateCiTokenRequest request, Long currentUserId) {
        // Sinh 24 bytes ngẫu nhiên -> hex string (48 ký tự)
        byte[] randomBytes = new byte[24];
        SECURE_RANDOM.nextBytes(randomBytes);
        String randomHex = bytesToHex(randomBytes);
        String rawToken = TOKEN_PREFIX + randomHex;

        // Lưu prefix 14 ký tự (ví dụ: lvd_ci_1a2b3c4d)
        String prefix = rawToken.substring(0, Math.min(rawToken.length(), 14));
        String tokenHash = hashToken(rawToken);

        Instant expiresAt = null;
        if (request.getExpiresInDays() != null && request.getExpiresInDays() > 0) {
            expiresAt = Instant.now().plus(request.getExpiresInDays(), ChronoUnit.DAYS);
        }

        CiToken ciToken = CiToken.builder()
                .tokenName(request.getTokenName().trim())
                .tokenHash(tokenHash)
                .tokenPrefix(prefix)
                .createdByUserId(currentUserId)
                .repositoryId(request.getRepositoryId())
                .description(request.getDescription())
                .isRevoked(false)
                .expiresAt(expiresAt)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        CiToken saved = ciTokenRepositoryPort.save(ciToken);

        // Ghi Audit Log
        auditServicePort.recordSecurityAction(
                currentUserId,
                AuditAction.CI_TOKEN_CREATED,
                "CiToken",
                String.valueOf(saved.getTokenId()),
                "Tạo mới CI Token: " + saved.getTokenName() + " (Prefix: " + prefix + ")"
        );

        return CreatedCiTokenResponse.builder()
                .tokenId(saved.getTokenId())
                .tokenName(saved.getTokenName())
                .token(rawToken) // Duy nhất lần này trả về chuỗi token đầy đủ
                .tokenPrefix(prefix)
                .repositoryId(saved.getRepositoryId())
                .expiresAt(saved.getExpiresAt())
                .createdAt(saved.getCreatedAt())
                .message("Lưu ý: Mã token chỉ hiển thị MỘT LẦN duy nhất. Vui lòng sao chép và cấu hình vào GitHub Secrets ngay bây giờ.")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CiTokenResponse> getAllTokens() {
        return ciTokenRepositoryPort.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CiTokenResponse> getTokensByRepository(Long repositoryId) {
        return ciTokenRepositoryPort.findByRepositoryId(repositoryId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public void revokeToken(Long tokenId, Long currentUserId) {
        CiToken token = ciTokenRepositoryPort.findById(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy CI Token với ID: " + tokenId));

        if (token.isRevoked()) {
            return; // Đã thu hồi rồi
        }

        ciTokenRepositoryPort.revokeToken(tokenId);

        auditServicePort.recordSecurityAction(
                currentUserId,
                AuditAction.CI_TOKEN_REVOKED,
                "CiToken",
                String.valueOf(tokenId),
                "Thu hồi CI Token: " + token.getTokenName() + " (Prefix: " + token.getTokenPrefix() + ")"
        );
    }

    @Override
    @Transactional
    public Optional<CiToken> validateAndTouchToken(String rawToken) {
        if (rawToken == null || !rawToken.startsWith(TOKEN_PREFIX)) {
            return Optional.empty();
        }

        String hash = hashToken(rawToken);
        Optional<CiToken> tokenOpt = ciTokenRepositoryPort.findByTokenHash(hash);

        if (tokenOpt.isEmpty()) {
            return Optional.empty();
        }

        CiToken token = tokenOpt.get();

        // Kiểm tra đã bị thu hồi chưa
        if (token.isRevoked()) {
            log.warn("CI Token {} đã bị thu hồi", token.getTokenPrefix());
            return Optional.empty();
        }

        // Kiểm tra hết hạn chưa
        if (token.getExpiresAt() != null && token.getExpiresAt().isBefore(Instant.now())) {
            log.warn("CI Token {} đã hết hạn vào {}", token.getTokenPrefix(), token.getExpiresAt());
            return Optional.empty();
        }

        // Cập nhật last_used_at
        token.setLastUsedAt(Instant.now());
        ciTokenRepositoryPort.save(token);

        return Optional.of(token);
    }

    private CiTokenResponse toResponse(CiToken token) {
        String createdByName = "Hệ thống";
        if (token.getCreatedByUserId() != null) {
            Optional<User> userOpt = userRepositoryPort.findById(token.getCreatedByUserId());
            if (userOpt.isPresent()) {
                createdByName = userOpt.get().getFullName() + " (" + userOpt.get().getEmail() + ")";
            }
        }

        String repoName = null;
        if (token.getRepositoryId() != null) {
            Optional<RepositoryEntity> repoOpt = springDataRepositoryRepository.findById(token.getRepositoryId());
            if (repoOpt.isPresent()) {
                repoName = repoOpt.get().getRepoFullName();
            }
        }

        return CiTokenResponse.builder()
                .tokenId(token.getTokenId())
                .tokenName(token.getTokenName())
                .tokenPrefix(token.getTokenPrefix())
                .createdByUserId(token.getCreatedByUserId())
                .createdByUserName(createdByName)
                .repositoryId(token.getRepositoryId())
                .repositoryName(repoName)
                .description(token.getDescription())
                .isRevoked(token.isRevoked())
                .expiresAt(token.getExpiresAt())
                .lastUsedAt(token.getLastUsedAt())
                .createdAt(token.getCreatedAt())
                .build();
    }

    private String resolveUserEmail(Long userId) {
        if (userId == null) return "system";
        return userRepositoryPort.findById(userId)
                .map(User::getEmail)
                .orElse("user-" + userId);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Lỗi thuật toán SHA-256", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder hexString = new StringBuilder();
        for (byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
