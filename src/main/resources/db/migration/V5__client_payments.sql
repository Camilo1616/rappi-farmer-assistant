CREATE TABLE `client_payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_id` bigint NOT NULL,
  `day` date NOT NULL,
  `type` varchar(20) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `note` varchar(200) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_client_payments_client_day` (`client_id`, `day`),
  KEY `IDX_client_payments_day` (`day`),
  CONSTRAINT `FK_client_payments_client` FOREIGN KEY (`client_id`) REFERENCES `dispatch_clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
