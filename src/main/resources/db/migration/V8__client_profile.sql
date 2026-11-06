-- Ficha del cliente (CRM): datos de contacto y notas
ALTER TABLE `dispatch_clients`
  ADD COLUMN `phone` varchar(30) DEFAULT NULL,
  ADD COLUMN `plaza` varchar(80) DEFAULT NULL;

CREATE TABLE `client_notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_id` bigint NOT NULL,
  `content` varchar(1000) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_client_notes_client` (`client_id`),
  CONSTRAINT `FK_client_notes_client` FOREIGN KEY (`client_id`) REFERENCES `dispatch_clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
