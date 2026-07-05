package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.DailyAiRecommendationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyAiRecommendationJpaRepository extends JpaRepository<DailyAiRecommendationEntity, Long> {
    Optional<DailyAiRecommendationEntity> findByUserIdAndRecDate(Long userId, LocalDate recDate);
}
