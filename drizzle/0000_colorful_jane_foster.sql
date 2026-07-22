CREATE TABLE `client_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`date_of_birth` text DEFAULT '' NOT NULL,
	`onboarding_status` text DEFAULT 'in_progress' NOT NULL,
	`onboarding_step` integer DEFAULT 0 NOT NULL,
	`profile_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_profiles_user_email_unique` ON `client_profiles` (`user_email`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`policy_number` text DEFAULT '' NOT NULL,
	`processing_status` text DEFAULT 'processed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`request_type` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`policy_number` text NOT NULL,
	`policy_type` text DEFAULT '' NOT NULL,
	`carrier` text DEFAULT '' NOT NULL,
	`insured_name` text DEFAULT '' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`death_benefit` text DEFAULT '' NOT NULL,
	`monthly_premium` text DEFAULT '' NOT NULL,
	`effective_date` text DEFAULT '' NOT NULL,
	`beneficiaries` text DEFAULT '' NOT NULL,
	`cash_value` text DEFAULT '' NOT NULL,
	`source_file_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_policy_number_idx` ON `user_policies` (`user_email`,`policy_number`);