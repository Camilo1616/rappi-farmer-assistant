-- Reemplaza el modelo en kg (V3) por el flujo real de despacho: cajas por categoria.
DROP TABLE IF EXISTS `sale_orders`;
DROP TABLE IF EXISTS `sales`;
DROP TABLE IF EXISTS `crops`;
DROP TABLE IF EXISTS `strawberry_bank`;

CREATE TABLE `dispatch_sectors` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_dispatch_sectors_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dispatch_clients` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sector_id` bigint NOT NULL,
  `name` varchar(150) NOT NULL,
  `opening_balance` decimal(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `IDX_dispatch_clients_sector` (`sector_id`),
  CONSTRAINT `FK_dispatch_clients_sector` FOREIGN KEY (`sector_id`) REFERENCES `dispatch_sectors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `category_prices` (
  `category` varchar(20) NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `category_prices` (`category`, `price`) VALUES
  ('JUMBO', 90000), ('PRIMERA', 88000), ('SEGUNDA', 78000), ('TERCERA', 62000),
  ('CUARTA', 30000), ('QUINTA', 24000), ('MADURA', 24000), ('BOLSAS', 0);

CREATE TABLE `harvests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day` date NOT NULL,
  `category` varchar(20) NOT NULL,
  `boxes` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_harvests_day_cat` (`day`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `discards` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day` date NOT NULL,
  `category` varchar(20) NOT NULL,
  `boxes` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_discards_day_cat` (`day`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dispatch_lines` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day` date NOT NULL,
  `client_id` bigint NOT NULL,
  `category` varchar(20) NOT NULL,
  `ordered_boxes` int NOT NULL DEFAULT 0,
  `delivered_boxes` int NOT NULL DEFAULT 0,
  `unit_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_dispatch_lines` (`day`, `client_id`, `category`),
  KEY `IDX_dispatch_lines_client` (`client_id`),
  CONSTRAINT `FK_dispatch_lines_client` FOREIGN KEY (`client_id`) REFERENCES `dispatch_clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
