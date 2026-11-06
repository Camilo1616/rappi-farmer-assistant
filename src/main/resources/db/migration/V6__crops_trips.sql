-- Cultivos (proveedores con precio de compra por categoria) y entradas diarias de fresa
CREATE TABLE `crops` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `active` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_crops_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `crop_prices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `crop_id` bigint NOT NULL,
  `category` varchar(20) NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_crop_prices` (`crop_id`, `category`),
  CONSTRAINT `FK_crop_prices_crop` FOREIGN KEY (`crop_id`) REFERENCES `crops` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `crop_intakes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day` date NOT NULL,
  `crop_id` bigint NOT NULL,
  `category` varchar(20) NOT NULL,
  `boxes` int NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_crop_intakes` (`day`, `crop_id`, `category`),
  CONSTRAINT `FK_crop_intakes_crop` FOREIGN KEY (`crop_id`) REFERENCES `crops` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Viajes del conductor: lineas libres de ingreso (fletes) y gasto (ACPM, peajes, conductor...)
CREATE TABLE `trips` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day` date NOT NULL,
  `driver_name` varchar(120) DEFAULT NULL,
  `destination` varchar(120) DEFAULT NULL,
  `notes` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_trips_day` (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `trip_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `trip_id` bigint NOT NULL,
  `type` varchar(10) NOT NULL,
  `concept` varchar(120) NOT NULL,
  `boxes` int DEFAULT NULL,
  `unit_amount` decimal(12,2) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_trip_entries_trip` (`trip_id`),
  CONSTRAINT `FK_trip_entries_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Ajustes: tarifas frecuentes que se usan para rellenar lineas del viaje
CREATE TABLE `rate_presets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `kind` varchar(10) NOT NULL,
  `concept` varchar(120) NOT NULL,
  `unit_amount` decimal(12,2) DEFAULT NULL,
  `per_box` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_rate_presets` (`kind`, `concept`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `rate_presets` (`kind`, `concept`, `unit_amount`, `per_box`) VALUES
  ('INCOME',  'Flete finca (por caja)',  4500, b'1'),
  ('EXPENSE', 'Conductor por caja',      1000, b'1'),
  ('EXPENSE', 'Conductor fijo del viaje', NULL, b'0'),
  ('EXPENSE', 'ACPM',                    NULL, b'0'),
  ('EXPENSE', 'Peajes',                  NULL, b'0'),
  ('EXPENSE', 'Plaza',                   NULL, b'0'),
  ('EXPENSE', 'Comida',                  NULL, b'0'),
  ('EXPENSE', 'Cotero',                  NULL, b'0');
