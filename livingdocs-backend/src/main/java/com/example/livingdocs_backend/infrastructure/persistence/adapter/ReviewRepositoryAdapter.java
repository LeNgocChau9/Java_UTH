package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.Review;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ReviewRepositoryAdapter implements ReviewRepositoryPort {

    private final SpringDataReviewRepository springDataReviewRepository;

    @Override
    public Review save(Review domain) {
        ReviewEntity entity = toEntity(domain);
        ReviewEntity saved = springDataReviewRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<Review> findById(Long reviewId) {
        return springDataReviewRepository.findById(reviewId).map(this::toDomain);
    }

    @Override
    public List<Review> findByDocId(Long docId) {
        return springDataReviewRepository.findByDocIdOrderByCreatedAtDesc(docId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Review> findLatestByDocId(Long docId) {
        return springDataReviewRepository.findFirstByDocIdOrderByCreatedAtDesc(docId).map(this::toDomain);
    }

    private ReviewEntity toEntity(Review domain) {
        return ReviewEntity.builder()
                .reviewId(domain.getReviewId())
                .docId(domain.getDocId())
                .versionId(domain.getVersionId())
                .reviewer(domain.getReviewer())
                .generalComment(domain.getGeneralComment())
                .result(domain.getResult())
                .createdAt(domain.getCreatedAt())
                .build();
    }

    private Review toDomain(ReviewEntity entity) {
        return Review.builder()
                .reviewId(entity.getReviewId())
                .docId(entity.getDocId())
                .versionId(entity.getVersionId())
                .reviewer(entity.getReviewer())
                .generalComment(entity.getGeneralComment())
                .result(entity.getResult())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
