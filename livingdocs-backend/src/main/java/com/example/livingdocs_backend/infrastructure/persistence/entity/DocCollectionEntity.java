package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "doc_collections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocCollectionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "module_tag", length = 150)
    private String moduleTag;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "owner_name", length = 150)
    private String ownerName;

    @Column(name = "owner_email", length = 255)
    private String ownerEmail;

    @Column(name = "owner_role", length = 50)
    private String ownerRole;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
