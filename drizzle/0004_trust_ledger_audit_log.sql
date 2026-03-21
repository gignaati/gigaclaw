CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`action_type` text NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`summary` text NOT NULL,
	`metadata` text NOT NULL DEFAULT '{}',
	`prev_hash` text NOT NULL,
	`entry_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);
--> statement-breakpoint
CREATE INDEX `audit_log_action_type_idx` ON `audit_log` (`action_type`);
