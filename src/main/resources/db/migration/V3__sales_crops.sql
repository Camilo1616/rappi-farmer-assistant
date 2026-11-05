CREATE TABLE `crops` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `location` varchar(200) DEFAULT NULL,
  `harvested_kg` decimal(10,2) NOT NULL DEFAULT 0,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `strawberry_bank` (
  `id` bigint NOT NULL,
  `quantity_kg` decimal(10,2) NOT NULL DEFAULT 0,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `strawberry_bank` (`id`, `quantity_kg`, `updated_at`) VALUES (1, 0, NOW(6));

CREATE TABLE `sales` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(200) NOT NULL,
  `quantity_kg` decimal(10,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `crop_id` bigint DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_sales_crop` (`crop_id`),
  CONSTRAINT `FK_sales_crop` FOREIGN KEY (`crop_id`) REFERENCES `crops` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `sale_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sale_id` bigint NOT NULL,
  `quantity_kg` decimal(10,2) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_sale_orders_sale` (`sale_id`),
  CONSTRAINT `FK_sale_orders_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
