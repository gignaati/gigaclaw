# Changelog

## v1.6.0 — 2026-03-21


### ✨ New Features

- Hybrid Cloud+Local AI Mode + full audit fixes (v1.6.0) [`5e49622`](https://github.com/gignaati/gigaclaw/commit/5e496229b2e13dc2a88913ce7fb9beb8a16a5569)
- hybrid cloud+local AI mode with smart task routing (v1.6.0) [`9cb6ca9`](https://github.com/gignaati/gigaclaw/commit/9cb6ca9492062be58f391dd101db01b23da4f508)
- add comprehensive full application test suite (124 tests) [`d1bcaa0`](https://github.com/gignaati/gigaclaw/commit/d1bcaa0e814f9324024d874a8a0b93a26aa5723b)

### 🐛 Bug Fixes

- update package-lock.json to include next-themes@0.4.6 (unblocks CI npm ci) [`4adf029`](https://github.com/gignaati/gigaclaw/commit/4adf029b34db8a241ef487bd59b8e09143fc34c3)
- update stale version assertion in regression test (1.5.0 → 1.6.0) [`6c3ecff`](https://github.com/gignaati/gigaclaw/commit/6c3ecff7cfa50ddf68aeca58c689e3c959bed42d)
- update ASCII art logo from GigaBot to GigaClaw in setup wizard [`232ca1a`](https://github.com/gignaati/gigaclaw/commit/232ca1a8f1f75c1b83e61b91cccb2e220ff76ab2)
- update regression test expectations for GIGACLAW_SKIP_SETUP env var [`7fa816d`](https://github.com/gignaati/gigaclaw/commit/7fa816d92ae7934dcb38862a8818c0958d7b3ed0)
- rename remaining GigaBot refs in test suite and setup-local [`f66ff63`](https://github.com/gignaati/gigaclaw/commit/f66ff6374254d93428b6db31b76c7cf0fdbb8a22)
- brand rename in setup wizard + dependency cleanup [`3c98521`](https://github.com/gignaati/gigaclaw/commit/3c98521eec252ac4f4ab2a7c976c5bc44b3bd064)
- complete brand rename in setup, templates, and docs [`97570a9`](https://github.com/gignaati/gigaclaw/commit/97570a984150f6e8ff0def03081491e7a98838fc)
- resolve all P0/P1/P2 audit findings for v1.6.0 release health [`6742c63`](https://github.com/gignaati/gigaclaw/commit/6742c63a6fc47704c9acc735ca315e72e053734e)

### 📖 Documentation

- add hybrid mode documentation to CLAUDE.md, README.md, and .env.example [`a5f7e9a`](https://github.com/gignaati/gigaclaw/commit/a5f7e9a4a3205e48b271dcf5524a3fed5eb5c3eb)

### 🔧 Other Changes

- complete AS-IS codebase audit (v1.5.1) — 9-phase systematic review [`929e33a`](https://github.com/gignaati/gigaclaw/commit/929e33a6f457633bbb2959efe085f90b95ca57aa)

---

**Full Changelog**: https://github.com/gignaati/gigaclaw/compare/v1.5.1...v1.6.0

**npm**: `npm install gigaclaw@1.6.0` · **Upgrade**: `npx gigaclaw@latest upgrade`
---


## 1.2.4 — 2026-03-05

### Cross-Platform QA Release — Mac/Linux install + Windows login fixes

#### Bug 1 — Mac/Linux install failure: Node.js not found via `curl | bash`

**Root cause:** When bash runs via a pipe (`curl | bash`), it is non-interactive and non-login, so shell init files (`~/.bashrc`, `~/.zshrc`, `/etc/profile`) are never sourced. Node.js installed via Homebrew (`/opt/homebrew/bin`), nvm (`~/.nvm`), or asdf (`~/.asdf`) is therefore missing from PATH. The installer exited with `node: command not found`.

**Fix:** `install.sh` now explicitly sources all three version managers at startup before any Node.js check:
```bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
[ -s "$HOME/.asdf/asdf.sh" ] && . "$HOME/.asdf/asdf.sh"
```
This is the same pattern used by Homebrew, Rustup, and the nvm installer itself.

**Also added:** When Node.js is not found, the error message now shows platform-specific install instructions (`brew install node`, nvm one-liner, nodejs.org link) instead of a bare error.

#### Bug 2 — Windows login "unexpected syntax" error

**Root cause:** `AUTH_SECRET` was generated with `randomBytes(32).toString('base64')`, which produces characters `+`, `/`, and `=`. When dotenv parses an unquoted value containing these characters on Windows (e.g., `AUTH_SECRET=NB0vbs97v9M+ODL2=`), the `+` is treated as a space and `=` terminates the value. The JWT signing key is silently corrupted. NextAuth then fails to verify any session token and returns an opaque "unexpected syntax" error on the login page.

**Fix:** Switched to `base64url` encoding (RFC 4648 §5) in both `gigaclaw init` (`.env` seed) and `gigaclaw reset-auth`. `base64url` uses only `A-Z`, `a-z`, `0-9`, `-`, and `_` — no characters that require quoting in dotenv.

**Affected users:** Anyone who ran `gigaclaw init` on Windows before v1.2.4 has a corrupted `AUTH_SECRET`. Run `npm run reset-auth` to regenerate it, then restart the server.

#### Bug 3 — Windows `npm install` / `npm run build` / `git` command failures

**Root cause:** All `execSync` calls in `bin/cli.js` that invoke `npm`, `npx`, `git`, and `docker` were missing `shell: true`. On Windows, these commands are `.cmd` shims that only resolve when the shell is involved. Without `shell: true`, Node.js tries to execute `npm` as a binary directly, which fails with `ENOENT`.

**Fix:** Added `shell: true` to all 13 `execSync` calls in `bin/cli.js` that invoke external commands.

### Regression tests

12/12 tests pass. Test suite covers: syntax validation, `base64url` encoding (no `+/=` chars), Homebrew/nvm/asdf PATH block presence, `shell: true` coverage, and all setup file syntax checks.

---

## 1.2.3 — 2026-03-05

### Critical Fix: curl|bash setup wizard exits immediately (TTY re-attachment)

#### Root cause

When GigaClaw is installed via `curl -fsSL .../install.sh | bash`, bash's stdin
is the curl pipe. Every child process spawned by that bash script — including
`npm run setup` → `node setup/setup.mjs` — inherits that pipe as stdin.
`@clack/prompts` calls `setRawMode(stdin, true)` but since `stdin.isTTY` is
`undefined` (not a terminal), raw mode is skipped. The keypress listener fires
immediately with an EOF event, which `@clack/core` interprets as the cancel
action (`process.exit(0)`). The wizard exits before the user can select a mode.

#### Two-layer fix (defence in depth)

**Layer 1 — install.sh (shell level):**
Added `exec < /dev/tty` guard at the top of the script (same pattern used by
Homebrew, Rustup, and nvm). This redirects bash stdin from the curl pipe to the
controlling terminal before any child processes are spawned.

```bash
if [ ! -t 0 ] && [ -e /dev/tty ]; then
  exec < /dev/tty
fi
```

**Layer 2 — setup.mjs (Node.js level):**
Added a TTY guard that detects `process.stdin.isTTY === undefined` and
re-opens `/dev/tty` as a Node.js ReadStream, reassigning `process.stdin` so
that `@clack/prompts` receives a real terminal. Covers cases where
`setup.mjs` is called directly without going through `install.sh`.

#### Regression test

New script `scripts/test-tty-regression.mjs` (10 tests) validates both layers
and can be run with `npm run test:tty`. Added `test:tty` to `package.json`
scripts.

---

## 1.2.2 — 2026-03-04

### Branding: Remove all ThePopeBot / @stephengpope references

All mentions of the original upstream project (ThePopeBot) and its contributor (@stephengpope) have been removed from every public-facing file in the repository. GigaClaw is an independent product built and maintained by Gignaati — the historical inheritance language no longer appears anywhere in the codebase, documentation, or release notes.

#### Files cleaned

- `CHANGELOG.md` — v1.1.5 section reworded; all ThePopeBot references removed
- `scripts/notes_v1.1.1.md` — API route rename described without referencing the old name
- `scripts/notes_v1.1.2.md` — branding cleanup described as GigaClaw completion, not legacy replacement
- `scripts/notes_v1.1.5.md` — banner update described as GigaClaw identity, old banner ASCII art removed

---

## 1.2.1 — 2026-03-04

### Fixed — Onboarding friction (3 bugs from user report)

- **install.sh: auto-cd and auto-launch setup** — the one-command installer now automatically `cd`s into the project directory and launches `npm run setup` immediately. Previously, users who ran `npm run setup` from the parent directory got `npm error Missing script: "setup"` because they were in the wrong directory. The installer now handles this transparently with no manual steps required.
- **docker-compose.local.yml: removed private Docker image reference** — the compose file previously referenced `gignaati/gigaclaw:event-handler-*` which is a private image that requires `docker login` and does not exist publicly. It now uses `dockerfile_inline` to build GigaClaw directly from local source using the official `node:20-alpine` image. No registry login required. First build: ~2–3 minutes; subsequent starts: instant.
- **setup-local.mjs Step 5: replaced blind Docker launch with interactive start selector** — the wizard previously attempted `docker compose up -d` unconditionally, which failed with a pull error if Docker was not logged in or the image did not exist. Step 5 now:
  - Checks if Docker is available before offering it as an option
  - Offers three choices: `npm run dev` (recommended, no Docker), `docker compose` (only if Docker is detected), or `Start later`
  - Uses `--build` flag so Docker always builds from local source instead of pulling
  - Falls back gracefully with clear instructions if Docker fails

### Changed

- `install.sh` now also checks for Docker availability and shows an informational warning (not an error) if Docker is not installed, since Docker is optional for Local Mode
- Summary panel in Local Mode wizard now shows both start options side-by-side for clarity

---

## 1.2.0

**Released: March 2026**

### New Feature: Local Mode — 100% Offline Setup

`npm run setup` now opens with a **mode selector** before any other prompts. Users choose between:

- **Cloud Mode** — the existing GitHub + ngrok + Telegram flow (unchanged)
- **Local Mode** — 100% offline operation using Ollama for LLM inference; no GitHub, no ngrok, no Telegram required

#### What was added

**`setup/setup.mjs` (dispatcher)** — now a thin ~50-line file that prints the GigaClaw banner and routes to `setup-cloud.mjs` or `setup-local.mjs` based on the user's choice.

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
- Auth secret generation and `.env` writing with `GIGACLAW_MODE=local`, `LLM_PROVIDER=ollama`, `LLM_MODEL`, `OLLAMA_BASE_URL`, `NEXTAUTH_URL`
- Docker Compose startup using `docker-compose.local.yml` if present, falling back to `docker-compose.yml`

**`templates/docker-compose.local.yml`** — new compose template for local mode:
- GigaClaw on port 3000, Ollama reachable via `host.docker.internal:11434`
- `extra_hosts: host.docker.internal:host-gateway` for Linux compatibility
- Optional Ntfy push notification service behind `--profile notifications`
- Added to `MANAGED_PATHS` — kept in sync on `npx gigaclaw upgrade`

**Mode-aware `gigaclaw init`** — re-running `npx gigaclaw init` on a local-mode project (detected via `GIGACLAW_MODE=local` in `.env`) skips scaffolding of GitHub Actions workflow files, keeping the project clean.

---

## 1.1.5

**Released: March 2026**

### Fix: GigaClaw ASCII banner in setup wizard

The `npm run setup` and `npm run setup:telegram` commands now open with the correct **GigaClaw** slant-font banner and the tagline `India's Autonomous AI Agent · Powered by Gignaati`.

This change affects `setup/setup.mjs` and `setup/setup-telegram.mjs`. No functional behaviour is changed — only the visual header shown at wizard startup.

---

## 1.1.4

**Released: March 2026**

### Fix: middleware.js now auto-updated on upgrade

The `middleware.js` file has been added to the list of **managed files** that are automatically kept in sync with the package template during `npx gigaclaw init` and `npx gigaclaw upgrade`. Previously, users who installed Giga Bot before v1.1.3 would retain an old `middleware.js` that re-exported `config` from `gigaclaw/middleware`, causing the Next.js / Turbopack build error:

> "The `config` export in Middleware must be a static object literal."

Running `npx gigaclaw@latest upgrade` (or `npx gigaclaw init` in an existing project) will now automatically overwrite `middleware.js` with the correct template that defines `config` as a static inline literal.

### Fix: Remove `config` export from `gigaclaw/middleware`

The `config` export has been removed from `lib/auth/middleware.js` (the module exported as `gigaclaw/middleware`). This prevents the accidental re-export pattern entirely — even if a user manually writes `export { config } from 'gigaclaw/middleware'`, there is nothing to re-export, making the failure mode impossible.

---

## 1.2.57

### Drizzle Kit migrations

Database schema changes are now managed by Drizzle Kit instead of hand-written SQL. The old `initDatabase()` with raw `CREATE TABLE` and `ALTER TABLE` statements has been replaced by `migrate()`, which applies versioned migration files from `drizzle/`. Migrations run automatically on server startup — users upgrading gigaclaw get schema changes applied seamlessly without any manual steps.

Migration files ship inside the npm package, so they resolve from `node_modules/gigaclaw/drizzle/` at runtime regardless of the user's working directory.

**For package developers:** edit `lib/db/schema.js`, then run `npm run db:generate` to create a new migration file. Never write DDL SQL by hand.

---

## 1.2.x — The NPM Package Release

**Released: February 2026**

gigaclaw is now an installable NPM package. Instead of forking a repo and wiring everything together yourself, you run one command and get a fully configured AI agent project. This release replaces the old fork-based architecture entirely.

---

### Install in seconds

Run `npx gigaclaw init` and you have a working project. The interactive setup wizard walks you through API keys, GitHub secrets, and Telegram configuration — no more copying `.env.example` files and hunting for documentation. Upgrade later with a single command or let GitHub Actions handle it automatically.

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

When a new version of gigaclaw is published, a GitHub Actions workflow can open a PR to upgrade your project. Template files (workflows, Docker configs) are updated automatically. Your customizations in `config/` are never touched. You stay current without manual maintenance.

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

GitHub Actions workflows, Docker configs, and other infrastructure files are managed by the package. When you upgrade gigaclaw, `gigaclaw init` scaffolds updated versions of these files. Use `gigaclaw diff` to see what changed and `gigaclaw reset` to restore any file to the package default.

### Talk to your agent anywhere

A channel adapter pattern normalizes messages across platforms. Web chat and Telegram work today, and the base class makes it straightforward to add new channels. The old architecture was Telegram-only with no abstraction layer.

---

### Breaking changes

This release replaces the old fork-based architecture entirely. The old `event_handler/` Express server is gone, but your configuration files carry over to the new project.

**What's gone:**
- Fork-and-modify workflow — replaced by `npx gigaclaw init`
- Express server in `event_handler/` — replaced by Next.js route handlers in the package
- Single `.env` API key — replaced by database-backed key management
- File-based JSON conversation history — replaced by SQLite database
- Anthropic-only LLM support — replaced by multi-provider architecture
- Manual deployment — replaced by Docker Compose with Traefik

**To adopt the new architecture:** Run `npx gigaclaw init` in a fresh directory and run the setup wizard. Then copy over your configuration files — `config/SOUL.md`, `config/JOB_PLANNING.md`, `config/JOB_AGENT.md`, `config/CRONS.json`, `config/TRIGGERS.json`, and any custom `.md` files you created. Move your `.pi/skills/` directory and any cron/trigger shell scripts as well. Your agent's personality, scheduled jobs, and skills carry over — only the surrounding infrastructure changes.
