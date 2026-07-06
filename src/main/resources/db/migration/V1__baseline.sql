-- Baseline del esquema existente (volcado real de Railway el 2026-07-05 vía
-- `SHOW CREATE TABLE`). En la BD de producción, Flyway se baseline-a en V1 y
-- NO ejecuta este script (baseline-on-migrate=true, baseline-version=1) — ya
-- tiene estas tablas. En una BD nueva (local/dev/CI) sí se ejecuta completo,
-- dejando el esquema idéntico al de producción sin depender de
-- hibernate.ddl-auto.

CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `account_status` varchar(20) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `calendar_refresh_token` varchar(512) DEFAULT NULL,
  `country_code` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `farmer_code` varchar(20) DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `last_import_date` date DEFAULT NULL,
  `last_login_at` datetime(6) DEFAULT NULL,
  `lider_id` bigint DEFAULT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `activity_status` varchar(20) DEFAULT NULL,
  `last_activity` datetime(6) DEFAULT NULL,
  `whatsapp_phone_registered_at` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stores` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) DEFAULT NULL,
  `aging` int DEFAULT NULL,
  `aging_stage` varchar(10) DEFAULT NULL,
  `brand_id` varchar(50) DEFAULT NULL,
  `channel` varchar(50) DEFAULT NULL,
  `connection_percentage` decimal(5,2) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `current_status` varchar(50) DEFAULT NULL,
  `gestionar` varchar(5) DEFAULT NULL,
  `had_handoff` bit(1) DEFAULT NULL,
  `handoff_activated_at` date DEFAULT NULL,
  `last_login_date` date DEFAULT NULL,
  `onboarding_date` date DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `store_code` varchar(50) NOT NULL,
  `store_name` varchar(150) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `upload_date` date DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `credentials_date` date DEFAULT NULL,
  `follow_up_last_30d` varchar(255) DEFAULT NULL,
  `last_follow_up` date DEFAULT NULL,
  `backup_phone` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKde7abdc4t7p11hmkx9fw4qa4` (`store_code`),
  KEY `FKiw281hibigo41ijsvot42osjj` (`user_id`),
  CONSTRAINT `FKiw281hibigo41ijsvot42osjj` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `priority_bases` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_type` varchar(30) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `message` text NOT NULL,
  `lider_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK237pxd28hi405wy6as7nv2s9s` (`lider_id`),
  CONSTRAINT `FK237pxd28hi405wy6as7nv2s9s` FOREIGN KEY (`lider_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `bases` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `lider_id` bigint NOT NULL,
  `message` text,
  `title` varchar(200) NOT NULL,
  `type` varchar(30) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `base_assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_at` datetime(6) DEFAULT NULL,
  `base_id` bigint NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `farmer_id` bigint NOT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `farmer_comment` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `base_stores` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_id` bigint NOT NULL,
  `store_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `daily_ai_recommendations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `message` text,
  `priorities_json` longtext,
  `rec_date` date NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK805458eheyv46wvi5pvxgynuh` (`user_id`,`rec_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `daily_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ava_l7d` decimal(5,2) DEFAULT NULL,
  `ava_mtd` decimal(5,2) DEFAULT NULL,
  `ava_status` varchar(50) DEFAULT NULL,
  `connection_percentage` decimal(5,2) DEFAULT NULL,
  `metric_date` date NOT NULL,
  `orders_count` int DEFAULT NULL,
  `rappi_allies_connected` bit(1) DEFAULT NULL,
  `sales` int DEFAULT NULL,
  `store_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK8hj3h388mmdeweflfem33hbkb` (`store_id`),
  CONSTRAINT `FK8hj3h388mmdeweflfem33hbkb` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dashboard_snapshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `json_data` longtext NOT NULL,
  `snapshot_date` date NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKcywt6aoi9rlrpx1n5ohmhvrcp` (`user_id`,`snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `goals` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `effective_goal` int DEFAULT NULL,
  `goal_date` date NOT NULL,
  `no_contact_goal` int DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKb1mp6ulyqkpcw6bc1a2mr7v1g` (`user_id`),
  CONSTRAINT `FKb1mp6ulyqkpcw6bc1a2mr7v1g` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `google_sheets_credential` (
  `id` bigint NOT NULL,
  `connected_at` datetime(6) DEFAULT NULL,
  `connected_by_email` varchar(100) DEFAULT NULL,
  `refresh_token` varchar(512) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `managements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `brand_sync` bit(1) NOT NULL,
  `comments` text,
  `management_date` datetime(6) DEFAULT NULL,
  `management_type` varchar(50) NOT NULL,
  `result_type` varchar(50) NOT NULL,
  `store_id` bigint NOT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK66uua75np4wyo43x4ay4l4jcl` (`store_id`),
  KEY `FKra4a3smjytq36c7jsvhkyd8ww` (`user_id`),
  CONSTRAINT `FK66uua75np4wyo43x4ay4l4jcl` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  CONSTRAINT `FKra4a3smjytq36c7jsvhkyd8ww` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `message_templates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` varchar(1000) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `body` text,
  `created_at` datetime(6) DEFAULT NULL,
  `is_read` bit(1) NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `type` varchar(30) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `priorities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `generated_at` datetime(6) DEFAULT NULL,
  `priority_level` varchar(20) DEFAULT NULL,
  `reason` text,
  `resolved` bit(1) DEFAULT NULL,
  `store_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKhel2sx8tt66ks81p2n3rnh8nb` (`store_id`),
  CONSTRAINT `FKhel2sx8tt66ks81p2n3rnh8nb` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `priority_base_assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comments` text,
  `completed_at` datetime(6) DEFAULT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `base_id` bigint NOT NULL,
  `farmer_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKe7umt31o1k6hsq76mmj8jcpdo` (`base_id`),
  KEY `FK6cwj29eat6acoqtkkfn42imvk` (`farmer_id`),
  CONSTRAINT `FK6cwj29eat6acoqtkkfn42imvk` FOREIGN KEY (`farmer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKe7umt31o1k6hsq76mmj8jcpdo` FOREIGN KEY (`base_id`) REFERENCES `priority_bases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `priority_base_stores` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comments` text,
  `managed_at` datetime(6) DEFAULT NULL,
  `management_type` varchar(30) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `base_id` bigint NOT NULL,
  `farmer_id` bigint NOT NULL,
  `store_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK9x2dbwijyl7hr35p58qiexamo` (`base_id`),
  KEY `FK5bk5xygq6jh6ouqqumoqa0rpn` (`farmer_id`),
  KEY `FKbehmrqp4spx5qhugv3tt2tid4` (`store_id`),
  CONSTRAINT `FK5bk5xygq6jh6ouqqumoqa0rpn` FOREIGN KEY (`farmer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK9x2dbwijyl7hr35p58qiexamo` FOREIGN KEY (`base_id`) REFERENCES `priority_bases` (`id`),
  CONSTRAINT `FKbehmrqp4spx5qhugv3tt2tid4` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `whatsapp_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `error_message` text,
  `message` text NOT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `store_id` bigint NOT NULL,
  `user_id` bigint DEFAULT NULL,
  `contact_id` bigint NOT NULL,
  `contact_name` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKb9emc75k1y6f7w3oq9p268idh` (`store_id`),
  KEY `FKktu9msweuh6ks6f8tew9ie7t7` (`user_id`),
  CONSTRAINT `FKb9emc75k1y6f7w3oq9p268idh` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  CONSTRAINT `FKktu9msweuh6ks6f8tew9ie7t7` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
