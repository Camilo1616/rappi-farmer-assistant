CREATE TABLE `agm_seen_rows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `store_id` varchar(100) NOT NULL,
  `row_number` int NOT NULL,
  `first_seen_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_agm_seen_rows_row_number` (`row_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
