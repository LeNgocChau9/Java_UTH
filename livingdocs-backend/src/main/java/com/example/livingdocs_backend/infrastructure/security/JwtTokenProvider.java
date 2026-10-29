package com.example.livingdocs_backend.infrastructure.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long tokenValidityInMilliseconds;

    public JwtTokenProvider(
            @Value("${jwt.secret:LivingDocsSecureJwtSecretKeyMustBeAtLeast256BitsLongForHS256Security}") String secret,
            @Value("${jwt.expiration-seconds:86400}") long expirationSeconds) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.tokenValidityInMilliseconds = expirationSeconds * 1000;
    }

    public String generateToken(Long userId, String email, java.util.Collection<String> roles) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + tokenValidityInMilliseconds);

        return Jwts.builder()
                .subject(email)
                .claim("userId", userId)
                .claim("roles", roles != null ? roles : java.util.Collections.emptyList())
                .issuedAt(now)
                .expiration(validity)
                .signWith(secretKey)
                .compact();
    }

    public String generateToken(Long userId, String email) {
        return generateToken(userId, email, java.util.Collections.emptyList());
    }

    public String getEmailFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.getSubject();
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = getClaims(token);
        Object userIdObj = claims.get("userId");
        if (userIdObj instanceof Number number) {
            return number.longValue();
        }
        return null;
    }

    public java.util.List<String> getRolesFromToken(String token) {
        Claims claims = getClaims(token);
        Object rolesObj = claims.get("roles");
        if (rolesObj instanceof java.util.List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return java.util.Collections.emptyList();
    }

    public boolean validateToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .clockSkewSeconds(300)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getExpiration() == null
                    || !claims.getExpiration().before(new Date(System.currentTimeMillis() - 300_000));
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            org.slf4j.LoggerFactory.getLogger(JwtTokenProvider.class).warn("[validateToken] Token đã hết hạn: {}",
                    e.getMessage());
            return false;
        } catch (JwtException | IllegalArgumentException e) {
            org.slf4j.LoggerFactory.getLogger(JwtTokenProvider.class).warn("[validateToken] Token không hợp lệ: {}",
                    e.getMessage());
            return false;
        }
    }

    public long getExpirationSeconds() {
        return tokenValidityInMilliseconds / 1000;
    }

    public Claims getClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(secretKey)
                    .clockSkewSeconds(300)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (io.jsonwebtoken.ExpiredJwtException ex) {
            return ex.getClaims();
        }
    }
}
