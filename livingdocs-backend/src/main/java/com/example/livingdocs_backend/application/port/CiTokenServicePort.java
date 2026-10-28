package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.CiTokenResponse;
import com.example.livingdocs_backend.application.dto.CreateCiTokenRequest;
import com.example.livingdocs_backend.application.dto.CreatedCiTokenResponse;
import com.example.livingdocs_backend.domain.model.CiToken;

import java.util.List;
import java.util.Optional;

public interface CiTokenServicePort {
    CreatedCiTokenResponse createToken(CreateCiTokenRequest request, Long currentUserId);
    List<CiTokenResponse> getAllTokens();
    List<CiTokenResponse> getTokensByRepository(Long repositoryId);
    void revokeToken(Long tokenId, Long currentUserId);
    Optional<CiToken> validateAndTouchToken(String rawToken);
}
