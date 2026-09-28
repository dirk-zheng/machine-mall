-- Aurelia Ingredients B2B user-data schema (legacy database identifiers retained for compatibility)
-- Products, FAQs and editorial articles intentionally remain JSON-backed.

CREATE DATABASE IF NOT EXISTS `curva_denim_b2b`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `curva_denim_b2b`;

CREATE TABLE IF NOT EXISTS `users` (
  `visitor_id` VARCHAR(80) NOT NULL,
  `user_data` JSON NOT NULL,
  `account` VARCHAR(255) GENERATED ALWAYS AS
    (LOWER(JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.account')))) STORED,
  `role` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.role'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`),
  KEY `idx_users_account` (`account`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visitor_events` (
  `visitor_id` VARCHAR(80) NOT NULL,
  `event_id` VARCHAR(64) NOT NULL,
  `account` VARCHAR(255) NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `page_path` VARCHAR(500) NULL,
  `entity_type` VARCHAR(64) NULL,
  `entity_id` VARCHAR(128) NULL,
  `event_data` JSON NULL,
  `occurred_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`, `event_id`),
  KEY `idx_visitor_events_account_time` (`account`, `occurred_at`),
  KEY `idx_visitor_events_visitor_time` (`visitor_id`, `occurred_at`),
  KEY `idx_visitor_events_type_time` (`event_type`, `occurred_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `rfq_assortments` (
  `visitor_id` VARCHAR(80) NOT NULL,
  `assortment_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `quotes` (
  `quote_id` VARCHAR(64) NOT NULL,
  `quote_data` JSON NOT NULL,
  `reference` VARCHAR(64) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.reference'))) STORED,
  `account` VARCHAR(255) GENERATED ALWAYS AS
    (LOWER(JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.account')))) STORED,
  `visitor_id` VARCHAR(80) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.visitorId'))) STORED,
  `status` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.status'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`quote_id`),
  UNIQUE KEY `uq_quotes_reference` (`reference`),
  KEY `idx_quotes_account` (`account`),
  KEY `idx_quotes_visitor` (`visitor_id`),
  KEY `idx_quotes_status` (`status`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `im_rooms` (
  `room_id` VARCHAR(64) NOT NULL,
  `room_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`room_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `im_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `room_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `idx_im_messages_room_time` (`room_id`, `created_at`),
  CONSTRAINT `fk_im_messages_room`
    FOREIGN KEY (`room_id`) REFERENCES `im_rooms` (`room_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_conversations` (
  `conversation_id` VARCHAR(64) NOT NULL,
  `conversation_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`conversation_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_conversation_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `conversation_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `idx_support_messages_conversation_time` (`conversation_id`, `created_at`),
  CONSTRAINT `fk_support_messages_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `support_conversations` (`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `privacy_requests` (
  `request_id` VARCHAR(64) NOT NULL,
  `request_data` JSON NOT NULL,
  `reference` VARCHAR(64) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`request_data`, '$.reference'))) STORED,
  `visitor_id` VARCHAR(80) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`request_data`, '$.visitorId'))) STORED,
  `request_type` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`request_data`, '$.requestType'))) STORED,
  `status` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`request_data`, '$.status'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `uq_privacy_requests_reference` (`reference`),
  KEY `idx_privacy_requests_visitor` (`visitor_id`),
  KEY `idx_privacy_requests_status` (`status`)
) ENGINE=InnoDB;
