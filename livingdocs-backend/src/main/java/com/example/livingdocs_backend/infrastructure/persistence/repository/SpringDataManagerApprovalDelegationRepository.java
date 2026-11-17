package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalDelegationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataManagerApprovalDelegationRepository extends JpaRepository<ManagerApprovalDelegationEntity, Long> {

    List<ManagerApprovalDelegationEntity> findByWorkspaceId(Long workspaceId);

    List<ManagerApprovalDelegationEntity> findByWorkspaceIdAndActiveTrue(Long workspaceId);

    List<ManagerApprovalDelegationEntity> findByActiveTrue();
}
