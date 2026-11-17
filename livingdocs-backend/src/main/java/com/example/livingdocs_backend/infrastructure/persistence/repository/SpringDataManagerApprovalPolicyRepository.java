package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalPolicyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataManagerApprovalPolicyRepository extends JpaRepository<ManagerApprovalPolicyEntity, Long> {

    List<ManagerApprovalPolicyEntity> findByWorkspaceId(Long workspaceId);

    Optional<ManagerApprovalPolicyEntity> findByWorkspaceIdAndDocumentType(Long workspaceId, String documentType);

    Optional<ManagerApprovalPolicyEntity> findByDocumentType(String documentType);
}
