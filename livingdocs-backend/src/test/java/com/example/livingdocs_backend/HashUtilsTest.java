package com.example.livingdocs_backend;

import com.example.livingdocs_backend.domain.util.HashUtils;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HashUtilsTest {

    @Test
    void testCalculateVersionHash_deterministic() {
        String hash1 = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 1, "Hello World", "DEV", "MANUAL_CREATE"
        );
        String hash2 = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 1, "Hello World", "DEV", "MANUAL_CREATE"
        );

        assertNotNull(hash1);
        assertEquals(64, hash1.length());
        assertEquals(hash1, hash2, "Mã băm SHA-256 cùng đầu vào phải cho ra kết quả đồng nhất");
    }

    @Test
    void testCalculateVersionHash_changesOnContentModification() {
        String hash1 = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 1, "Original", "DEV", "MANUAL_CREATE"
        );
        String hash2 = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 1, "Modified", "DEV", "MANUAL_CREATE"
        );

        assertNotEquals(hash1, hash2, "Thay đổi nội dung phải làm thay đổi mã băm");
    }

    @Test
    void testCalculateVersionHash_changesOnPrevHashModification() {
        String hash1 = HashUtils.calculateVersionHash(
                HashUtils.GENESIS_HASH, 2, "Same Content", "DEV", "MANUAL_UPDATE"
        );
        String hash2 = HashUtils.calculateVersionHash(
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 2, "Same Content", "DEV", "MANUAL_UPDATE"
        );

        assertNotEquals(hash1, hash2, "Thay đổi prevHash phải làm thay đổi mã băm của phiên bản sau");
    }
}
