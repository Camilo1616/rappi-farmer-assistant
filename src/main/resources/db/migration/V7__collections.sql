-- Cobro presencial: hojas de cobro por conductor, pagos por metodo, vacias (empaque) y entrega de efectivo
ALTER TABLE `client_payments`
  ADD COLUMN `method` varchar(15) DEFAULT NULL,
  ADD COLUMN `received_by` varchar(60) DEFAULT NULL,
  ADD COLUMN `run_id` bigint DEFAULT NULL,
  ADD KEY `IDX_client_payments_run` (`run_id`);

ALTER TABLE `dispatch_clients`
  ADD COLUMN `opening_packaging` int NOT NULL DEFAULT 0;

CREATE TABLE `collection_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day` date NOT NULL,
  `driver_name` varchar(120) DEFAULT NULL,
  `destination` varchar(120) DEFAULT NULL,
  `trip_id` bigint DEFAULT NULL,
  `handed_amount` decimal(14,2) DEFAULT NULL,
  `handed_to` varchar(60) DEFAULT NULL,
  `closed` bit(1) NOT NULL DEFAULT b'0',
  `notes` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_collection_runs_day` (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `collection_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `run_id` bigint NOT NULL,
  `client_id` bigint NOT NULL,
  `owed_snapshot` decimal(14,2) NOT NULL DEFAULT 0,
  `packaging_snapshot` int NOT NULL DEFAULT 0,
  `added_manually` bit(1) NOT NULL DEFAULT b'0',
  `needs_review` bit(1) NOT NULL DEFAULT b'0',
  `resolution` varchar(12) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_collection_items` (`run_id`, `client_id`),
  CONSTRAINT `FK_collection_items_run` FOREIGN KEY (`run_id`) REFERENCES `collection_runs` (`id`),
  CONSTRAINT `FK_collection_items_client` FOREIGN KEY (`client_id`) REFERENCES `dispatch_clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `packaging_returns` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_id` bigint NOT NULL,
  `day` date NOT NULL,
  `boxes` int NOT NULL,
  `run_id` bigint DEFAULT NULL,
  `note` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_packaging_returns_client` (`client_id`, `day`),
  KEY `IDX_packaging_returns_run` (`run_id`),
  CONSTRAINT `FK_packaging_returns_client` FOREIGN KEY (`client_id`) REFERENCES `dispatch_clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
