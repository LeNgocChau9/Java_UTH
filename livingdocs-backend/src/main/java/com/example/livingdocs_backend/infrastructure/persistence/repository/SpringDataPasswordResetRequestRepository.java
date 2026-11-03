package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.infrastructure.persistence.entity.PasswordResetRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataPasswordResetRequestRepository extends JpaRepository<PasswordResetRequestEntity, Long> {

    List<PasswordResetRequestEntity> findAllByOrderByCreatedAtDesc();

    List<PasswordResetRequestEntity> findByStatusOrderByCreatedAtDesc(String status);

    Optional<PasswordResetRequestEntity> findFirstByEmailAndStatusOrderByCreatedAtDesc(String email, String status);
}
