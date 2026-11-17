package com.example.livingdocs_backend.infrastructure.bootstrap;

import com.example.livingdocs_backend.application.dto.ApprovalPolicyDto;
import com.example.livingdocs_backend.application.dto.ManagerDelegationDto;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalDelegationEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalPolicyEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataManagerApprovalDelegationRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataManagerApprovalPolicyRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Migration runner chuyển đổi dữ liệu cấu hình phê duyệt và ủy quyền
 * từ JSON blob trong admin_settings sang 2 bảng quan hệ:
 * manager_approval_policies và manager_approval_delegations.
 */
@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class ApprovalConfigMigrationRunner implements ApplicationRunner {

    private final SpringDataManagerApprovalPolicyRepository policyRepository;
    private final SpringDataManagerApprovalDelegationRepository delegationRepository;
    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private UserRepositoryPort userRepositoryPort;

    public static final String KEY_APPROVAL_POLICIES = "approval_policies";
    public static final String KEY_MANAGER_DELEGATIONS = "manager_delegations";

    @Override
    public void run(ApplicationArguments args) {
        try {
            migrateApprovalPolicies();
            migrateManagerDelegations();
        } catch (Exception ex) {
            log.error("[ApprovalConfigMigrationRunner] Lỗi trong quá trình di chuyển dữ liệu cấu hình: {}", ex.getMessage(), ex);
        }
    }

    public void migrateApprovalPolicies() {
        List<ManagerApprovalPolicyEntity> existing = policyRepository.findByWorkspaceId(1L);
        Map<String, ApprovalPolicyDto> normalizedMap = new LinkedHashMap<>();

        if (existing == null || existing.isEmpty()) {
            List<ApprovalPolicyDto> dtoList = null;
            Optional<AdminSettingEntity> settingOpt = adminSettingRepository.findById(KEY_APPROVAL_POLICIES);
            if (settingOpt.isPresent() && settingOpt.get().getSettingValue() != null && !settingOpt.get().getSettingValue().isBlank()) {
                try {
                    dtoList = objectMapper.readValue(settingOpt.get().getSettingValue(), new TypeReference<List<ApprovalPolicyDto>>() {});
                    log.info("[ApprovalConfigMigrationRunner] Đọc được {} chính sách từ admin_settings JSON blob.", dtoList.size());
                } catch (Exception e) {
                    log.warn("[ApprovalConfigMigrationRunner] Lỗi parse JSON approval_policies từ admin_settings: {}", e.getMessage());
                }
            }

            if (dtoList != null) {
                for (ApprovalPolicyDto dto : dtoList) {
                    if (dto == null) continue;
                    String docType = normalizeDocType(dto.getDocType());
                    normalizedMap.putIfAbsent(docType, dto);
                }
            }
        } else {
            log.info("[ApprovalConfigMigrationRunner] Bảng manager_approval_policies đã có {} bản ghi; kiểm tra bổ sung chính sách mặc định còn thiếu.", existing.size());
        }

        for (ApprovalPolicyDto def : createDefaultPolicies()) {
            String docType = normalizeDocType(def.getDocType());
            normalizedMap.putIfAbsent(docType, def);
        }

        int savedCount = 0;
        for (Map.Entry<String, ApprovalPolicyDto> entry : normalizedMap.entrySet()) {
            String docType = entry.getKey();
            ApprovalPolicyDto dto = entry.getValue();
            if (policyRepository.findByWorkspaceIdAndDocumentType(1L, docType).isPresent()) {
                continue;
            }
            int tiers = dto.getTiers() != null && dto.getTiers() == 1 ? 1 : 2;
            ManagerApprovalPolicyEntity entity = ManagerApprovalPolicyEntity.builder()
                    .workspaceId(1L)
                    .documentType(docType)
                    .approvalRequired(tiers > 1)
                    .mergePolicy("WARN")
                    .tiers(tiers)
                    .description(dto.getDescription())
                    .updatedByEmail(dto.getUpdatedBy() != null ? dto.getUpdatedBy() : "SYSTEM")
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            policyRepository.save(entity);
            savedCount++;
        }
        log.info("[ApprovalConfigMigrationRunner] Đã đồng bộ và lưu {} chính sách mới vào manager_approval_policies.", savedCount);
    }

    private void migrateManagerDelegations() {
        List<ManagerApprovalDelegationEntity> existing = delegationRepository.findByWorkspaceId(1L);
        if (existing != null && !existing.isEmpty()) {
            log.info("[ApprovalConfigMigrationRunner] Bảng manager_approval_delegations đã có {} bản ghi. Bỏ qua migration.", existing.size());
            return;
        }

        Optional<AdminSettingEntity> settingOpt = adminSettingRepository.findById(KEY_MANAGER_DELEGATIONS);
        if (settingOpt.isEmpty() || settingOpt.get().getSettingValue() == null || settingOpt.get().getSettingValue().isBlank()) {
            log.info("[ApprovalConfigMigrationRunner] Không có dữ liệu manager_delegations cũ trong admin_settings.");
            return;
        }

        try {
            List<ManagerDelegationDto> dtoList = objectMapper.readValue(
                    settingOpt.get().getSettingValue(),
                    new TypeReference<List<ManagerDelegationDto>>() {}
            );
            if (dtoList == null || dtoList.isEmpty()) {
                return;
            }

            for (ManagerDelegationDto dto : dtoList) {
                Instant start = parseDate(dto.getFromDate(), true);
                Instant end = parseDate(dto.getToDate(), false);
                Long delegatorId = dto.getDelegatorId();
                if (delegatorId == null && userRepositoryPort != null && dto.getDelegatorEmail() != null && !dto.getDelegatorEmail().isBlank()) {
                    delegatorId = userRepositoryPort.findByEmail(dto.getDelegatorEmail().trim())
                            .map(u -> u.getUserId())
                            .orElse(null);
                }
                Long delegateeId = dto.getDelegateeId();
                if (delegateeId == null && userRepositoryPort != null && dto.getDelegateeEmail() != null && !dto.getDelegateeEmail().isBlank()) {
                    delegateeId = userRepositoryPort.findByEmail(dto.getDelegateeEmail().trim())
                            .map(u -> u.getUserId())
                            .orElse(null);
                }

                ManagerApprovalDelegationEntity entity = ManagerApprovalDelegationEntity.builder()
                        .workspaceId(1L)
                        .delegatorId(delegatorId)
                        .delegateId(delegateeId)
                        .delegatorName(dto.getDelegatorName())
                        .delegatorEmail(dto.getDelegatorEmail())
                        .delegateeName(dto.getDelegateeName())
                        .delegateeEmail(dto.getDelegateeEmail())
                        .active(dto.getActive() != null ? dto.getActive() : true)
                        .startsAt(start)
                        .endsAt(end)
                        .reason(dto.getReason())
                        .createdAt(Instant.now())
                        .build();
                delegationRepository.save(entity);
            }
            log.info("[ApprovalConfigMigrationRunner] Đã di chuyển {} ủy quyền vào manager_approval_delegations.", dtoList.size());
        } catch (Exception ex) {
            log.warn("[ApprovalConfigMigrationRunner] Lỗi parse/migrate manager_delegations: {}", ex.getMessage());
        }
    }

    private String normalizeDocType(String docType) {
        if (docType == null) return "DEFAULT";
        String dt = docType.trim().toUpperCase();
        if ("API".equals(dt)) return "API_REFERENCE";
        if ("ARCHITECTURE".equals(dt)) return "ARCHITECTURE_ADR";
        if ("USER_GUIDE".equals(dt) || "RELEASE_NOTE".equals(dt)) return "MODULE_GUIDE";
        return dt;
    }

    private List<ApprovalPolicyDto> createDefaultPolicies() {
        String nowStr = Instant.now().toString();
        List<ApprovalPolicyDto> list = new ArrayList<>();
        list.add(ApprovalPolicyDto.builder()
                .docType("API_REFERENCE")
                .tiers(1)
                .description("Tài liệu kỹ thuật API - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("PROJECT_README")
                .tiers(1)
                .description("Tài liệu README dự án - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("MODULE_GUIDE")
                .tiers(1)
                .description("Hướng dẫn module & sử dụng - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("ARCHITECTURE_ADR")
                .tiers(2)
                .description("Tài liệu Kiến trúc hệ thống (ADR) - Phê duyệt 2 cấp (Staff duyệt -> Manager ký duyệt)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("PROJECT_DOCUMENTATION")
                .tiers(2)
                .description("Tài liệu Dự án Tiêu chuẩn (10 Phần) - Phê duyệt 2 cấp (Staff duyệt -> Manager ký duyệt)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("DEFAULT")
                .tiers(2)
                .description("Chính sách mặc định cho các tài liệu khác - Phê duyệt 2 cấp")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        return list;
    }

    private Instant parseDate(String dateStr, boolean isStart) {
        if (dateStr == null || dateStr.isBlank()) {
            return isStart ? Instant.now() : null;
        }
        try {
            if (dateStr.length() >= 10) {
                LocalDate ld = LocalDate.parse(dateStr.substring(0, 10));
                return ld.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            return Instant.parse(dateStr);
        } catch (Exception e) {
            return isStart ? Instant.now() : null;
        }
    }
}
