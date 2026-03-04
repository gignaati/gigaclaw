# Changelog

## 1.2.0

**Released: March 2026**

### New Feature: Local Mode — 100% Offline Setup

`npm run setup` now opens with a **mode selector** before any other prompts. Users choose between:

- **Cloud Mode** — the existing GitHub + ngrok + Telegram flow (unchanged)
- **Local Mode** — 100% offline operation using Ollama for LLM inference; no GitHub, no ngrok, no Telegram required

#### What was added

**`setup/setup.mjs` (dispatcher)** — now a thin ~50-line file that prints the GigaBot banner and routes to `setup-cloud.mjs` or `setup-local.mjs` based on the user's choice.

**`setup/setup-cloud.mjs`** — the original wizard, renamed and exported as `run()`. Zero functional changes to the cloud flow.

**`setup/setup-local.mjs`** — new local-mode wizard with:
- Caution banner listing what is unavailable (Telegram, GitHub runners, ngrok) and what works (web chat, cron jobs, Ollama inference, file uploads, Ntfy notifications)
- Ollama health check (`localhost:11434`) with retry loop and platform-specific install instructions
- RAM detection via `os.totalmem()` with automatic model recommendation by hardware tier:
  - 8 GB or less → `llama3.2:3b`
  - 16 GB → `llama3.1:8b`
  - 32 GB → `llama3.1:70b-q4_0` (quantised)
  - 64 GB+ → `llama3.1:70b` (full precision)
- Interactive model selector showing already-pulled Ollama models; custom model name entry as fallback
- Auth secret generation and `.env` writing with `GIGABOT_MODE=local`, `LLM_PROVIDER=ollama`, `LLM_MODEL`, `OLLAMA_BASE_URL`, `NEXTAUTH_URL`
- Docker Compose startup using `docker-compose.local.yml` if present, falling back to `docker-compose.yml`

**`templates/docker-compose.local.yml`** — new compose template for local mode:
- GigaBot on port 3000, Ollama reachable via `host.docker.internal:11434`
- `extra_hosts: host.docker.internal:host-gateway` for Linux compatibility
- Optional Ntfy push notification service behind `--profile notifications`
- Added to `MANAGED_PATHS` — kept in sync on `npx gigabot upgrade`

**Mode-aware `gigabot init`** — re-running `npx gigabot init` on a local-mode project (detected via `GIGABOT_MODE=local` in `.env`) skips scaffolding of GitHub Actions workflow files, keeping the project clean.

---

## 1.1.5

**Released: March 2026**

### Fix: Replace ThePopeBot ASCII banner with GigaBot branding

The `npm run setup` and `npm run setup:telegram` commands previously displayed a `ThePopeBot` ASCII art banner — a leftover from the pre-Gignaati era. Both setup wizards now open with a clean **GigaBot** slant-font banner and the tagline `India's Autonomous AI Agent · Powered by Gignaati`.

This change affects `setup/setup.mjs` and `setup/setup-telegram.mjs`. No functional behaviour is changed — only the visual header shown at wizard startup.

---

## 1.1.4

**Released: March 2026**

### Fix: middleware.js now auto-updated on upgrade

The `middleware.js` file has been added to the list of **managed files** that are automatically kept in sync with the package template during `npx gigabot init` and `npx gigabot upgrade`. Previously, users who installed Giga Bot before v1.1.3 would retain an old `middleware.js` that re-exported `config` from `gigabot/middleware`, causing the Next.js / Turbopack build error:

> "The `config` export in Middleware must be a static object literal."

Running `npx gigabot@latest upgrade` (or `npx gigabot init` in an existing project) will now automatically overwrite `middleware.js` with the correct template that defines `config` as a static inline literal.

### Fix: Remove `config` export from `gigabot/middleware`

The `config` export has been removed from `lib/auth/middleware.js` (the module exported as `gigabot/middleware`). This prevents the accidental re-export pattern entirely — even if a user manually writes `export { config } from 'gigabot/middleware'`, there is nothing to re-export, making the failure mode impossible.

---

## 1.2.57

### Drizzle Kit migrations

Database schema changes are now managed by Drizzle Kit instead of hand-written SQL. The old `initDatabase()` with raw `CREATE TABLE` and `ALTER TABLE` statements has been replaced by `migrate()`, which applies versioned migration files from `drizzle/`. Migrations run automatically on server startup — users upgrading gigabot get schema changes applied seamlessly without any manual steps.

Migration files ship inside the npm package, so they resolve from `node_modules/gigabot/drizzle/` at runtime regardless of the user's working directory.

**For package developers:** edit `lib/db/schema.js`, then run `npm run db:generate` to create a new migration file. Never write DDL SQL by hand.

---

## 1.2.x — The NPM Package Release

**Released: February 2026**

gigabot is now an installable NPM package. Instead of forking a repo and wiring everything together yourself, you run one command and get a fully configured AI agent project. This release replaces the old fork-based architecture entirely.

---

### Install in seconds

Run `npx gigabot init` and you have a working project. The interactive setup wizard walks you through API keys, GitHub secrets, and Telegram configuration — no more copying `.env.example` files and hunting for documentation. Upgrade later with a single command or let GitHub Actions handle it automatically.

### Web chat interface

Your agent now has a full web app. Chat with streaming responses, browse conversation history grouped by date, and pick up where you left off. Upload images, PDFs, and code files directly in the chat — the AI can see and analyze them. It's your own private ChatGPT-style interface for your agent.

### Choose your LLM

Switch between Anthropic, OpenAI, and Google models by changing two environment variables (`LLM_PROVIDER` and `LLM_MODEL`). No code changes needed. The old architecture was hardcoded to Anthropic — now you pick the model that fits the task and the budget.

### See what your agent is doing

The Swarm page shows every active and completed job in real time. See which tasks are running, cancel jobs that went sideways, and rerun completed ones. No more checking GitHub Actions logs to figure out what your agent is up to.

### Never miss a completed job

In-app notifications with unread badges tell you when jobs finish. Telegram notifications give you the summary on your phone. Every notification includes what the agent did, what files changed, and whether the PR merged — so you know the outcome without opening GitHub.

### Secure API access

API keys are hashed with SHA-256 and verified with timing-safe comparison. Create, rotate, and revoke keys from the settings page. The old single-key-in-`.env` approach is gone — you can now issue separate keys for different integrations and revoke them independently.

### Production deployment built in

`docker compose up` gives you Traefik with automatic HTTPS, PM2 process management, and a self-hosted GitHub Actions runner. The old architecture required you to figure out deployment yourself. Now it's one command with TLS certificates handled automatically via Let's Encrypt.

### Auto-upgrades

When a new version of gigabot is published, a GitHub Actions workflow can open a PR to upgrade your project. Template files (workflows, Docker configs) are updated automatically. Your customizations in `config/` are never touched. You stay current without manual maintenance.

### Three ways to automate

Cron jobs and webhook triggers now support three action types:

- **Agent** — spin up the full AI agent in a Docker container for tasks that need thinking
- **Command** — run a shell script directly on the server for tasks that just need doing
- **Webhook** — fire an HTTP request to an external service

The old architecture only had agent jobs. Now quick tasks don't burn LLM credits or GitHub Actions minutes.

### Upload files to chat

Drag and drop images, PDFs, and code files into the chat. Images are analyzed with AI vision. PDFs and text files are read and included in the conversation context. Useful for asking your agent about screenshots, error logs, or documents.

### Authentication out of the box

NextAuth v5 with JWT sessions protects the web interface. The first time you visit, you create an admin account — no separate setup step. API routes use key-based auth for external callers; the browser UI uses session cookies via server actions. Two auth paths, each suited to its caller.

### Persistent conversations

All chats are stored in SQLite via Drizzle ORM. Browse history, resume old conversations, and search across past chats. The old architecture wrote JSON files to disk with no way to search or manage them.

### Infrastructure stays current

GitHub Actions workflows, Docker configs, and other infrastructure files are managed by the package. When you upgrade gigabot, `gigabot init` scaffolds updated versions of these files. Use `gigabot diff` to see what changed and `gigabot reset` to restore any file to the package default.

### Talk to your agent anywhere

A channel adapter pattern normalizes messages across platforms. Web chat and Telegram work today, and the base class makes it straightforward to add new channels. The old architecture was Telegram-only with no abstraction layer.

---

### Breaking changes

This release replaces the old fork-based architecture entirely. The old `event_handler/` Express server is gone, but your configuration files carry over to the new project.

**What's gone:**
- Fork-and-modify workflow — replaced by `npx gigabot init`
- Express server in `event_handler/` — replaced by Next.js route handlers in the package
- Single `.env` API key — replaced by database-backed key management
- File-based JSON conversation history — replaced by SQLite database
- Anthropic-only LLM support — replaced by multi-provider architecture
- Manual deployment — replaced by Docker Compose with Traefik

**To adopt the new architecture:** Run `npx gigabot init` in a fresh directory and run the setup wizard. Then copy over your configuration files — `config/SOUL.md`, `config/JOB_PLANNING.md`, `config/JOB_AGENT.md`, `config/CRONS.json`, `config/TRIGGERS.json`, and any custom `.md` files you created. Move your `.pi/skills/` directory and any cron/trigger shell scripts as well. Your agent's personality, scheduled jobs, and skills carry over — only the surrounding infrastructure changes.
