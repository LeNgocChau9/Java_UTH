package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.CollectionDocumentsRequest;
import com.example.livingdocs_backend.application.dto.CollectionOwnerDto;
import com.example.livingdocs_backend.application.dto.DocCollectionRequest;
import com.example.livingdocs_backend.application.dto.DocCollectionResponse;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.RoleType;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCollectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCollectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.web.controller.DocCollectionController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class DocumentCollectionOwnershipTest {

    private SpringDataDocCollectionRepository collectionRepository;
    private SpringDataDocumentRepository documentRepository;
    private DocumentServicePort documentServicePort;
    private UserRepositoryPort userRepositoryPort;
    private DocCollectionController controller;

    private Map<Long, DocCollectionEntity> collectionStore;
    private Map<Long, DocumentEntity> documentStore;
    private Map<Long, User> userStore;
    private long nextCollectionId = 1L;

    @BeforeEach
    void setUp() {
        collectionRepository = mock(SpringDataDocCollectionRepository.class);
        documentRepository = mock(SpringDataDocumentRepository.class);
        documentServicePort = mock(DocumentServicePort.class);
        userRepositoryPort = mock(UserRepositoryPort.class);

        collectionStore = new HashMap<>();
        documentStore = new HashMap<>();
        userStore = new HashMap<>();
        nextCollectionId = 1L;

        User techLead = User.builder()
                .userId(10L)
                .fullName("Trần Minh Khoa")
                .email("khoa.tran@livingdocs.internal")
                .status("ACTIVE")
                .roles(Set.of(RoleType.ROLE_TECH_LEAD))
                .build();

        User developer = User.builder()
                .userId(20L)
                .fullName("Lê Hoàng Nam")
                .email("nam.le@livingdocs.internal")
                .status("ACTIVE")
                .roles(Set.of(RoleType.ROLE_DEVELOPER))
                .build();

        User lockedUser = User.builder()
                .userId(30L)
                .fullName("Tài khoản Khóa")
                .email("locked@livingdocs.internal")
                .status("LOCKED")
                .roles(Set.of(RoleType.ROLE_DEVELOPER))
                .build();

        userStore.put(10L, techLead);
        userStore.put(20L, developer);
        userStore.put(30L, lockedUser);

        DocumentEntity doc1 = DocumentEntity.builder()
                .docId(101L)
                .repoId(1L)
                .title("Đặc tả Auth & JWT Security")
                .status(DocumentStatus.PUBLISHED)
                .build();

        DocumentEntity doc2 = DocumentEntity.builder()
                .docId(102L)
                .repoId(1L)
                .title("Hướng dẫn tích hợp OAuth2 GitHub")
                .status(DocumentStatus.DRAFT)
                .build();

        documentStore.put(101L, doc1);
        documentStore.put(102L, doc2);

        when(userRepositoryPort.findById(anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return Optional.ofNullable(userStore.get(id));
        });
        when(userRepositoryPort.findAll()).thenAnswer(inv -> new ArrayList<>(userStore.values()));

        when(collectionRepository.save(any(DocCollectionEntity.class))).thenAnswer(inv -> {
            DocCollectionEntity entity = inv.getArgument(0);
            if (entity.getId() == null) {
                entity.setId(nextCollectionId++);
                entity.setCreatedAt(Instant.now());
            }
            entity.setUpdatedAt(Instant.now());
            collectionStore.put(entity.getId(), entity);
            return entity;
        });
        when(collectionRepository.findById(anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return Optional.ofNullable(collectionStore.get(id));
        });
        when(collectionRepository.existsById(anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return collectionStore.containsKey(id);
        });
        when(collectionRepository.findAll()).thenAnswer(inv -> new ArrayList<>(collectionStore.values()));
        doAnswer(inv -> {
            Long id = inv.getArgument(0);
            collectionStore.remove(id);
            return null;
        }).when(collectionRepository).deleteById(anyLong());

        when(documentRepository.findById(anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return Optional.ofNullable(documentStore.get(id));
        });
        when(documentRepository.findByCollectionId(anyLong())).thenAnswer(inv -> {
            Long colId = inv.getArgument(0);
            return documentStore.values().stream()
                    .filter(d -> Objects.equals(d.getCollectionId(), colId))
                    .collect(Collectors.toList());
        });
        when(documentRepository.save(any(DocumentEntity.class))).thenAnswer(inv -> {
            DocumentEntity d = inv.getArgument(0);
            documentStore.put(d.getDocId(), d);
            return d;
        });

        controller = new DocCollectionController(
                collectionRepository,
                documentRepository,
                documentServicePort,
                userRepositoryPort
        );
    }

    @Test
    void createCollectionWithOwnerAssignment_populatesOwnerDetailsAndModuleTag() {
        DocCollectionRequest createReq = DocCollectionRequest.builder()
                .name("Phân hệ Xác thực & Phân quyền")
                .description("Tập hợp tài liệu kiến trúc bảo mật, JWT và phân quyền RBAC.")
                .moduleTag("Auth & Security")
                .ownerId(10L)
                .build();

        ResponseEntity<DocCollectionResponse> response = controller.createCollection(createReq);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        DocCollectionResponse body = response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.getId());
        assertEquals("Phân hệ Xác thực & Phân quyền", body.getName());
        assertEquals("Auth & Security", body.getModuleTag());
        assertEquals(10L, body.getOwnerId());
        assertEquals("Trần Minh Khoa", body.getOwnerName());
        assertEquals("khoa.tran@livingdocs.internal", body.getOwnerEmail());
        assertEquals("TECH_LEAD", body.getOwnerRole());
        assertEquals(0L, body.getDocumentCount());
    }

    @Test
    void updateCollection_changesNameModuleAndReassignsOwner() {
        DocCollectionResponse created = controller.createCollection(DocCollectionRequest.builder()
                .name("Phân hệ Thanh toán")
                .description("Mô tả ban đầu")
                .moduleTag("Payment")
                .ownerId(10L)
                .build()).getBody();
        assertNotNull(created);

        DocCollectionRequest updateReq = DocCollectionRequest.builder()
                .name("Phân hệ Thanh toán & Đối soát v2")
                .description("Cập nhật mô tả nghiệp vụ đối soát tự động")
                .moduleTag("Payment & Billing")
                .ownerId(20L)
                .documentIds(List.of(101L))
                .build();

        ResponseEntity<DocCollectionResponse> updatedRes = controller.updateCollection(created.getId(), updateReq);

        assertEquals(HttpStatus.OK, updatedRes.getStatusCode());
        DocCollectionResponse updated = updatedRes.getBody();
        assertNotNull(updated);
        assertEquals("Phân hệ Thanh toán & Đối soát v2", updated.getName());
        assertEquals("Cập nhật mô tả nghiệp vụ đối soát tự động", updated.getDescription());
        assertEquals("Payment & Billing", updated.getModuleTag());
        assertEquals(20L, updated.getOwnerId());
        assertEquals("Lê Hoàng Nam", updated.getOwnerName());
        assertEquals("nam.le@livingdocs.internal", updated.getOwnerEmail());
        assertEquals("DEVELOPER", updated.getOwnerRole());
        assertEquals(1L, updated.getDocumentCount());
        assertTrue(updated.getDocumentIds().contains(101L));
    }

    @Test
    void assignAndRemoveDocuments_updatesCollectionMembershipCorrectly() {
        DocCollectionResponse created = controller.createCollection(DocCollectionRequest.builder()
                .name("Bộ sưu tập Core Engine")
                .ownerId(10L)
                .build()).getBody();
        assertNotNull(created);
        Long colId = created.getId();

        // Assign 2 documents to collection
        ResponseEntity<DocCollectionResponse> afterAssign = controller.assignDocumentsToCollection(
                colId,
                CollectionDocumentsRequest.builder()
                        .documentIds(List.of(101L, 102L))
                        .replaceAll(true)
                        .build()
        );
        assertEquals(2L, Objects.requireNonNull(afterAssign.getBody()).getDocumentCount());
        assertEquals(colId, documentStore.get(101L).getCollectionId());
        assertEquals(colId, documentStore.get(102L).getCollectionId());

        // Remove 1 document from collection
        ResponseEntity<DocCollectionResponse> afterRemove = controller.removeDocumentFromCollection(colId, 101L);
        assertEquals(1L, Objects.requireNonNull(afterRemove.getBody()).getDocumentCount());
        assertNull(documentStore.get(101L).getCollectionId());
        assertEquals(colId, documentStore.get(102L).getCollectionId());
    }

    @Test
    void deleteCollection_unassignsAllDocumentsAndDeletesEntity() {
        DocCollectionResponse created = controller.createCollection(DocCollectionRequest.builder()
                .name("Bộ sưu tập Tạm thời")
                .ownerId(20L)
                .documentIds(List.of(101L, 102L))
                .build()).getBody();
        assertNotNull(created);
        Long colId = created.getId();
        assertEquals(colId, documentStore.get(101L).getCollectionId());

        ResponseEntity<Map<String, Object>> deleteRes = controller.deleteCollection(colId);

        assertEquals(HttpStatus.OK, deleteRes.getStatusCode());
        assertFalse(collectionStore.containsKey(colId));
        assertNull(documentStore.get(101L).getCollectionId());
        assertNull(documentStore.get(102L).getCollectionId());
    }

    @Test
    void listCollectionOwners_returnsOnlyActiveUsersWithRoleLabels() {
        ResponseEntity<List<CollectionOwnerDto>> res = controller.listCollectionOwners();

        assertEquals(HttpStatus.OK, res.getStatusCode());
        List<CollectionOwnerDto> owners = res.getBody();
        assertNotNull(owners);
        assertEquals(2, owners.size());
        assertTrue(owners.stream().anyMatch(o -> o.getUserId().equals(10L) && "TECH_LEAD".equals(o.getRole())));
        assertTrue(owners.stream().anyMatch(o -> o.getUserId().equals(20L) && "DEVELOPER".equals(o.getRole())));
        assertFalse(owners.stream().anyMatch(o -> o.getUserId().equals(30L)));
    }
}
