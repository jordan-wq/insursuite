CREATE TABLE `agent_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_email` text NOT NULL,
	`client_email` text NOT NULL,
	`service_request_id` integer NOT NULL,
	`title` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`role` text NOT NULL,
	`message` text NOT NULL,
	`resolution` text DEFAULT 'answered' NOT NULL,
	`service_request_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `service_requests` ADD `assigned_to` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_requests` ADD `source` text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_requests` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_requests` ADD `unread_by_agent` integer DEFAULT true NOT NULL;