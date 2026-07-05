package com.rappi.farmer.infrastructure.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        migrateFollowUpLast30dToVarchar();
    }

    private void migrateFollowUpLast30dToVarchar() {
        try {
            String dataType = jdbcTemplate.queryForObject(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS " +
                "WHERE TABLE_NAME = 'stores' AND COLUMN_NAME = 'follow_up_last_30d' " +
                "AND TABLE_SCHEMA = DATABASE()",
                String.class
            );
            if (dataType != null && dataType.equalsIgnoreCase("int")) {
                jdbcTemplate.execute(
                    "ALTER TABLE stores MODIFY COLUMN follow_up_last_30d VARCHAR(20)"
                );
                log.info("Migración: follow_up_last_30d convertida de INT a VARCHAR(20)");
            }
        } catch (Exception e) {
            log.warn("No se pudo migrar follow_up_last_30d: {}", e.getMessage());
        }
    }
}
