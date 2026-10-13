package com.example.livingdocs_backend.domain.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Tiện ích mã hóa băm (SHA-256) phục vụ việc liên kết chuỗi băm (hash chain)
 * giữa các phiên bản tài liệu để chống giả mạo và bảo đảm toàn vẹn lịch sử.
 */
public final class HashUtils {

    /** Giá trị băm khởi tạo (Genesis Hash) cho phiên bản đầu tiên của tài liệu (64 ký tự 0) */
    public static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    private HashUtils() {
        // Utility class
    }

    /**
     * Tính toán mã băm SHA-256 cho phiên bản tài liệu dựa trên:
     * prevHash, versionNum, content, actorRole, triggerType.
     *
     * @param prevHash    Mã băm của phiên bản trước (hoặc GENESIS_HASH nếu là v1)
     * @param versionNum  Số thứ tự phiên bản
     * @param content     Nội dung văn bản
     * @param actorRole   Vai trò tác nhân (AI, DEV, STAFF, MANAGER)
     * @param triggerType Loại kích hoạt (MANUAL_CREATE, MANUAL_UPDATE, AUTO_SYNC, ...)
     * @return Chuỗi băm 64 ký tự hex chữ thường
     */
    public static String calculateVersionHash(String prevHash, int versionNum, String content, String actorRole, String triggerType) {
        String safePrev = (prevHash != null && !prevHash.isBlank()) ? prevHash : GENESIS_HASH;
        String safeContent = (content != null) ? content : "";
        String safeRole = (actorRole != null && !actorRole.isBlank()) ? actorRole : "DEV";
        String safeTrigger = (triggerType != null && !triggerType.isBlank()) ? triggerType : "MANUAL";

        String rawData = safePrev + ":" + versionNum + ":" + safeContent + ":" + safeRole + ":" + safeTrigger;
        return sha256(rawData);
    }

    /**
     * Băm chuỗi đầu vào bằng thuật toán SHA-256.
     *
     * @param input Chuỗi cần băm
     * @return Chuỗi băm hex 64 ký tự
     */
    public static String sha256(String input) {
        if (input == null) {
            input = "";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedHash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(2 * encodedHash.length);
            for (byte b : encodedHash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Không tìm thấy thuật toán SHA-256 trên môi trường Java Runtime", e);
        }
    }
}
