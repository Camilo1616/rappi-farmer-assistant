package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreJpaRepository extends JpaRepository<StoreEntity, Long> {
    Optional<StoreEntity> findFirstByStoreCode(String storeCode);
    Optional<StoreEntity> findFirstByBrandId(String brandId);
    List<StoreEntity> findAllByBrandId(String brandId);
    List<StoreEntity> findByStoreCodeContainingIgnoreCaseOrStoreNameContainingIgnoreCase(String code, String name);
    List<StoreEntity> findByActiveTrue();
    List<StoreEntity> findByUser_IdAndActiveTrue(Long userId);
    long countByUser_IdAndActiveTrue(Long userId);
    List<StoreEntity> findByUser_Id(Long userId);
    void deleteByUser_Id(Long userId);
    List<StoreEntity> findByStoreCodeContainingIgnoreCaseOrStoreNameContainingIgnoreCaseAndUser_Id(
            String code, String name, Long userId);

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.active = true AND (" +
        "  LOWER(s.storeCode)    LIKE LOWER(CONCAT('%',:q,'%')) OR " +
        "  LOWER(s.storeName)    LIKE LOWER(CONCAT('%',:q,'%')) OR " +
        "  LOWER(s.brandId)      LIKE LOWER(CONCAT('%',:q,'%')) OR " +
        "  LOWER(s.phoneNumber)  LIKE LOWER(CONCAT('%',:q,'%')))")
    List<StoreEntity> searchByAnyField(
        @org.springframework.data.repository.query.Param("q") String q);

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id = :userId AND s.active = true AND (" +
        "  LOWER(s.storeCode)    LIKE LOWER(CONCAT('%',:q,'%')) OR " +
        "  LOWER(s.storeName)    LIKE LOWER(CONCAT('%',:q,'%')) OR " +
        "  LOWER(s.brandId)      LIKE LOWER(CONCAT('%',:q,'%')) OR " +
        "  LOWER(s.phoneNumber)  LIKE LOWER(CONCAT('%',:q,'%')))")
    List<StoreEntity> searchByAnyFieldAndUser(
        @org.springframework.data.repository.query.Param("q") String q,
        @org.springframework.data.repository.query.Param("userId") Long userId);

    // ── Queries para bases de priorización ──

    /** CHURN: HO=true + status M1, M2 o churn */
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.user.id = :farmerId AND s.active = true " +
        "AND s.hadHandoff = true " +
        "AND (LOWER(s.currentStatus) LIKE '%m1%' OR LOWER(s.currentStatus) LIKE '%m2%' OR LOWER(s.currentStatus) LIKE '%churn%')")
    List<StoreEntity> findChurnByFarmer(@org.springframework.data.repository.query.Param("farmerId") Long farmerId);

    /** ACTIVE_F7D: HO=SI + días 1-8 desde handoff_activated_at; fallback a aging u onboarding_date */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.user_id = :farmerId AND s.active = true AND s.had_handoff = true " +
        "AND (" +
        "  (s.handoff_activated_at IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.handoff_activated_at) BETWEEN 1 AND 8) " +
        "  OR (s.handoff_activated_at IS NULL AND s.aging IS NOT NULL AND s.aging BETWEEN 1 AND 8) " +
        "  OR (s.handoff_activated_at IS NULL AND s.aging IS NULL AND s.onboarding_date IS NOT NULL " +
        "      AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 1 AND 8)" +
        ")", nativeQuery = true)
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

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.user_id IN :farmerIds AND s.active = true AND s.had_handoff = true " +
        "AND (" +
        "  (s.handoff_activated_at IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.handoff_activated_at) BETWEEN 1 AND 8) " +
        "  OR (s.handoff_activated_at IS NULL AND s.aging IS NOT NULL AND s.aging BETWEEN 1 AND 8) " +
        "  OR (s.handoff_activated_at IS NULL AND s.aging IS NULL AND s.onboarding_date IS NOT NULL " +
        "      AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 1 AND 8)" +
        ")", nativeQuery = true)
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

    /** Self sin handoff aún: para activación automática */
    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.active = true " +
        "AND s.handoffActivatedAt IS NULL " +
        "AND LOWER(s.channel) LIKE '%self%'")
    List<StoreEntity> findActiveSelfWithoutHandoff();

    @org.springframework.data.jpa.repository.Query(
        "SELECT s FROM StoreEntity s WHERE s.active = true AND s.hadHandoff = true " +
        "AND (LOWER(s.currentStatus) LIKE '%m1%' OR LOWER(s.currentStatus) LIKE '%m2%' OR LOWER(s.currentStatus) LIKE '%churn%')")
    List<StoreEntity> findChurnGlobal();

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.active = true AND s.had_handoff = true " +
        "AND (" +
        "  (s.handoff_activated_at IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.handoff_activated_at) BETWEEN 1 AND 8) " +
        "  OR (s.handoff_activated_at IS NULL AND s.aging IS NOT NULL AND s.aging BETWEEN 1 AND 8) " +
        "  OR (s.handoff_activated_at IS NULL AND s.aging IS NULL AND s.onboarding_date IS NOT NULL " +
        "      AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 1 AND 8)" +
        ")", nativeQuery = true)
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

    /** CHURN M1: AGING stage = M1 y AVA_MTD <= 10% o sin dato (última métrica disponible) */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT s.* FROM stores s " +
        "LEFT JOIN daily_metrics dm ON dm.store_id = s.id " +
            "AND dm.metric_date = (SELECT MAX(dm2.metric_date) FROM daily_metrics dm2 WHERE dm2.store_id = s.id) " +
        "WHERE s.active = true " +
        "AND UPPER(TRIM(s.aging_stage)) = 'M1' " +
        "AND (dm.ava_mtd IS NULL OR (dm.ava_mtd >= 0 AND dm.ava_mtd <= 10)) " +
        "AND s.user_id IN :farmerIds", nativeQuery = true)
    List<StoreEntity> findChurnM1ByFarmerIds(
        @org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    /** ACTIVE: GESTIONAR = SI y upload_date entre :minDays y :maxDays días atrás */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.active = true " +
        "AND UPPER(TRIM(s.gestionar)) = 'SI' " +
        "AND s.upload_date IS NOT NULL " +
        "AND DATEDIFF(CURRENT_DATE(), s.upload_date) >= :minDays " +
        "AND DATEDIFF(CURRENT_DATE(), s.upload_date) <= :maxDays " +
        "AND s.user_id IN :farmerIds", nativeQuery = true)
    List<StoreEntity> findActiveByFarmerIdsAndDays(
        @org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds,
        @org.springframework.data.repository.query.Param("minDays") int minDays,
        @org.springframework.data.repository.query.Param("maxDays") int maxDays);

    /**
     * ACTIVE 7 días: exactamente 7 días desde onboarding_date (calculado dinámicamente),
     * HO exitoso (had_handoff = true), al menos una gestión EFECTIVA
     * (cualquier canal) y SIN ventas registradas (orders_count = 0 o sin métricas).
     */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT s.* FROM stores s " +
        "WHERE s.active = true " +
        "AND s.user_id IN :farmerIds " +
        "AND s.had_handoff = true " +
        "AND s.onboarding_date IS NOT NULL " +
        "AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) = 7 " +
        "AND EXISTS ( " +
        "  SELECT 1 FROM managements m " +
        "  WHERE m.store_id = s.id AND m.result_type = 'EFECTIVA' " +
        ") " +
        "AND NOT EXISTS ( " +
        "  SELECT 1 FROM daily_metrics dm " +
        "  WHERE dm.store_id = s.id AND dm.orders_count > 0 " +
        ") " +
        "ORDER BY s.store_name ASC", nativeQuery = true)
    List<StoreEntity> findActive7DaysWithSuccessfulManagement(
        @org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    /**
     * ACTIVE 8-28 días: entre 8 y 28 días desde onboarding_date,
     * HO exitoso, al menos una gestión EFECTIVA y SIN ventas.
     */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT s.* FROM stores s " +
        "WHERE s.active = true " +
        "AND s.user_id IN :farmerIds " +
        "AND s.had_handoff = true " +
        "AND s.onboarding_date IS NOT NULL " +
        "AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 8 AND 28 " +
        "AND EXISTS ( " +
        "  SELECT 1 FROM managements m " +
        "  WHERE m.store_id = s.id AND m.result_type = 'EFECTIVA' " +
        ") " +
        "AND NOT EXISTS ( " +
        "  SELECT 1 FROM daily_metrics dm " +
        "  WHERE dm.store_id = s.id AND dm.orders_count > 0 " +
        ") " +
        "ORDER BY s.store_name ASC", nativeQuery = true)
    List<StoreEntity> findActive8to28DaysWithSuccessfulManagement(
        @org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    // ── Queries de diagnóstico (temporal) ──

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds", nativeQuery = true)
    long countDebugTotal(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true", nativeQuery = true)
    long countDebugHandoff(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true AND s.onboarding_date IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) = 7", nativeQuery = true)
    long countDebugFecha7(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true AND s.onboarding_date IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 8 AND 28", nativeQuery = true)
    long countDebugFecha8a28(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true AND EXISTS (SELECT 1 FROM managements m WHERE m.store_id = s.id AND m.result_type = 'EFECTIVA')", nativeQuery = true)
    long countDebugEfectiva(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true AND NOT EXISTS (SELECT 1 FROM daily_metrics dm WHERE dm.store_id = s.id AND dm.orders_count > 0)", nativeQuery = true)
    long countDebugSinVentas(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true AND s.onboarding_date IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) = 7 AND EXISTS (SELECT 1 FROM managements m WHERE m.store_id = s.id AND m.result_type = 'EFECTIVA') AND NOT EXISTS (SELECT 1 FROM daily_metrics dm WHERE dm.store_id = s.id AND dm.orders_count > 0)", nativeQuery = true)
    long countDebugFinal7(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT COUNT(*) FROM stores s WHERE s.active = true AND s.user_id IN :farmerIds AND s.had_handoff = true AND s.onboarding_date IS NOT NULL AND DATEDIFF(CURRENT_DATE(), s.onboarding_date) BETWEEN 8 AND 28 AND EXISTS (SELECT 1 FROM managements m WHERE m.store_id = s.id AND m.result_type = 'EFECTIVA') AND NOT EXISTS (SELECT 1 FROM daily_metrics dm WHERE dm.store_id = s.id AND dm.orders_count > 0)", nativeQuery = true)
    long countDebugFinal8a28(@org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    /**
     * GESTIONAR_IS: Inside Sales + sin HO + sin Follow Up (last_follow_up nulo y follow_up_last_30d = 'NO').
     */
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT s.* FROM stores s " +
        "WHERE s.active = true " +
        "AND s.user_id IN :farmerIds " +
        "AND LOWER(s.channel) LIKE '%inside%' " +
        "AND s.had_handoff = false " +
        "AND s.last_follow_up IS NULL " +
        "AND UPPER(s.follow_up_last_30d) = 'NO' " +
        "ORDER BY s.store_name ASC", nativeQuery = true)
    List<StoreEntity> findGestionarIsByFarmerIds(
        @org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds);

    /** @deprecated Reemplazado por findActive7DaysWithSuccessfulManagement */
    @Deprecated
    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM stores s WHERE s.active = true " +
        "AND (s.last_login_date IS NULL OR DATEDIFF(CURRENT_DATE(), s.last_login_date) >= :days) " +
        "AND s.user_id IN :farmerIds " +
        "ORDER BY s.last_login_date ASC", nativeQuery = true)
    List<StoreEntity> findActiveNoLoginByFarmerIds(
        @org.springframework.data.repository.query.Param("farmerIds") List<Long> farmerIds,
        @org.springframework.data.repository.query.Param("days") int days);
}
