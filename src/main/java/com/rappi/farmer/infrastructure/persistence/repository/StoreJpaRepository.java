package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreJpaRepository extends JpaRepository<StoreEntity, Long> {
    Optional<StoreEntity> findByStoreCode(String storeCode);
    List<StoreEntity> findByStoreCodeContainingIgnoreCaseOrStoreNameContainingIgnoreCase(String code, String name);
    List<StoreEntity> findByActiveTrue();
    List<StoreEntity> findByUser_IdAndActiveTrue(Long userId);
    long countByUser_IdAndActiveTrue(Long userId);
    List<StoreEntity> findByUser_Id(Long userId);
    void deleteByUser_Id(Long userId);
    List<StoreEntity> findByStoreCodeContainingIgnoreCaseOrStoreNameContainingIgnoreCaseAndUser_Id(
            String code, String name, Long userId);

    // ── Queries para bases de priorización ──

    /** CHURN: HO=true + status M1, M2 o churn */
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id = :farmerId AND s.active = true " +
        "AND s.hadHandoff = true " +
        "AND (LOWER(s.currentStatus) LIKE '%m1%' OR LOWER(s.currentStatus) LIKE '%m2%' OR LOWER(s.currentStatus) LIKE '%churn%')")
    List<StoreEntity> findChurnByFarmer(@org.springframework.data.repository.query.Param("farmerId") Long farmerId);

    /** ACTIVE_F7D: HO=true + aging 1-8 días (columna AGING del Excel) */
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id = :farmerId AND s.active = true " +
        "AND s.hadHandoff = true AND s.aging IS NOT NULL AND s.aging BETWEEN 1 AND 8")
    List<StoreEntity> findActiveF7dByFarmer(@org.springframework.data.repository.query.Param("farmerId") Long farmerId);

    /** RETENCION: HO=true + AVA entre 1% y 15% */
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id = :farmerId AND s.active = true " +
        "AND s.hadHandoff = true " +
        "AND s.connectionPercentage IS NOT NULL AND s.connectionPercentage BETWEEN 1 AND 15")
    List<StoreEntity> findRetencionByFarmer(@org.springframework.data.repository.query.Param("farmerId") Long farmerId);

    /** AVA_8_14: HO=true + aging 8-14 días + AVA < 60% o sin datos aún */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.user_id = :farmerId AND s.active = true " +
        "AND (" +
        "  (s.aging IS NOT NULL AND s.aging BETWEEN 8 AND 14) " +
        "  OR (s.aging IS NULL AND s.onboarding_date IS NOT NULL " +
        "      AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 8 AND 14)" +
        ")", nativeQuery = true)
    List<StoreEntity> findAva8a14ByFarmer(@org.springframework.data.repository.query.Param("farmerId") Long farmerId);

    List<StoreEntity> findByUser_IdAndIdIn(Long userId, List<Long> ids);

    // ── Queries por lista de farmers ──

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id IN :farmerIds AND s.active = true " +
        "AND s.hadHandoff = true " +
        "AND (LOWER(s.currentStatus) LIKE '%m1%' OR LOWER(s.currentStatus) LIKE '%m2%' OR LOWER(s.currentStatus) LIKE '%churn%')")
    List<StoreEntity> findChurnByFarmers(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id IN :farmerIds AND s.active = true " +
        "AND s.hadHandoff = true AND s.aging IS NOT NULL AND s.aging BETWEEN 1 AND 8")
    List<StoreEntity> findActiveF7dByFarmers(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id IN :farmerIds AND s.active = true " +
        "AND s.hadHandoff = true " +
        "AND s.connectionPercentage IS NOT NULL AND s.connectionPercentage BETWEEN 1 AND 15")
    List<StoreEntity> findRetencionByFarmers(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.user_id IN :farmerIds AND s.active = true " +
        "AND (" +
        "  (s.aging IS NOT NULL AND s.aging BETWEEN 8 AND 14) " +
        "  OR (s.aging IS NULL AND s.onboarding_date IS NOT NULL " +
        "      AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 8 AND 14)" +
        ")", nativeQuery = true)
    List<StoreEntity> findAva8a14ByFarmers(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id IN :farmerIds AND s.active = true " +
        "AND s.hadHandoff = true")
    List<StoreEntity> findAllActiveByFarmers(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    // ── Queries globales (sin filtro de farmer) ──

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.active = true AND s.hadHandoff = true " +
        "AND (LOWER(s.currentStatus) LIKE '%m1%' OR LOWER(s.currentStatus) LIKE '%m2%' OR LOWER(s.currentStatus) LIKE '%churn%')")
    List<StoreEntity> findChurnGlobal();

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.active = true AND s.hadHandoff = true " +
        "AND s.aging IS NOT NULL AND s.aging BETWEEN 1 AND 8")
    List<StoreEntity> findActiveF7dGlobal();

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.active = true AND s.hadHandoff = true " +
        "AND s.connectionPercentage IS NOT NULL AND s.connectionPercentage BETWEEN 1 AND 15")
    List<StoreEntity> findRetencionGlobal();

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.active = true " +
        "AND (" +
        "  (s.aging IS NOT NULL AND s.aging BETWEEN 8 AND 14) " +
        "  OR (s.aging IS NULL AND s.onboarding_date IS NOT NULL " +
        "      AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 8 AND 14)" +
        ")", nativeQuery = true)
    List<StoreEntity> findAva8a14Global();
}
