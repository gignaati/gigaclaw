-- Migration 0005: Knowledge Base Document Sharing — v1.8.1
-- Adds share_tokens table for generating public shareable links to KB documents.
-- Tokens are UUID-based, support expiry, access caps, permission levels, and revocation.

CREATE TABLE IF NOT EXISTS `share_tokens` (
  `id`           text PRIMARY KEY NOT NULL,
  `user_id`      text NOT NULL,
  `doc_path`     text NOT NULL,
  `doc_name`     text NOT NULL,
  `permission`   text NOT NULL DEFAULT 'view',
  `expires_at`   integer,
  `access_count` integer NOT NULL DEFAULT 0,
  `max_access`   integer,
  `revoked`      integer NOT NULL DEFAULT 0,
  `created_at`   integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `share_tokens_user_idx`    ON `share_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `share_tokens_doc_idx`     ON `share_tokens` (`doc_path`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `share_tokens_revoked_idx` ON `share_tokens` (`revoked`);
