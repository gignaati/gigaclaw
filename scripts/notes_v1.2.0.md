Giga Bot v1.2.0 introduces **Local Mode** — a fully offline operating mode that lets you run GigaClaw on your own machine without any internet connection, GitHub account, ngrok tunnel, or Telegram bot.

---

## What's New in v1.2.0

### 🚀 Feature: Local Mode — 100% Offline Setup

`npm run setup` now opens with a **mode selector** as the very first prompt:

```
◆  How do you want to run GigaClaw?
│  ● Cloud Mode   (GitHub + ngrok + Telegram — full features, internet required)
│  ○ Local Mode   (Ollama only — 100% offline, no Telegram or GitHub needed)
```

Choosing **Cloud Mode** routes to the existing wizard with zero changes. Choosing **Local Mode** starts a new dedicated offline wizard.

---

### Local Mode wizard walkthrough

**Step 1 — Caution banner**

Before proceeding, the wizard clearly states what is unavailable and what still works:

```
What you are giving up in Local Mode:
  ✗  Telegram bot integration
  ✗  GitHub-triggered jobs
  ✗  ngrok tunnel
  ✗  Automatic upgrades via GitHub Actions

What still works perfectly:
  ✓  Web chat interface at http://localhost:3000
  ✓  Cron-scheduled jobs
  ✓  Ollama LLM inference — any model you have pulled
  ✓  File uploads and AI vision
  ✓  API key management
  ✓  Persistent conversation history (SQLite)
  ✓  Job queue and Swarm view
  ✓  Push notifications via Ntfy (LAN only, optional)
```

**Step 2 — Ollama health check**

Checks `localhost:11434`. If Ollama is not running, shows platform-specific install instructions and waits for you to start it before continuing.

**Step 3 — Automatic model recommendation**

Detects your machine's RAM and recommends the largest model your hardware can run:

| RAM | Recommended Model |
|---|---|
| 8 GB or less | `llama3.2:3b` |
| 16 GB | `llama3.1:8b` |
| 32 GB | `llama3.1:70b-q4_0` (quantised) |
| 64 GB+ | `llama3.1:70b` (full precision) |

If you already have models pulled, they appear in a selector. You can also type any custom model name.

**Step 4 — Configuration**

Writes `.env` with:
- `GIGACLAW_MODE=local`
- `LLM_PROVIDER=ollama`
- `LLM_MODEL=<your chosen model>`
- `OLLAMA_BASE_URL=http://localhost:11434`
- `NEXTAUTH_URL=http://localhost:3000`
- Auto-generated `AUTH_SECRET` and `NEXTAUTH_SECRET`

No GitHub PAT, no ngrok token, no Telegram bot token required.

**Step 5 — Start**

Launches GigaClaw using `docker-compose.local.yml` (or falls back to `docker-compose.yml`). Access the web interface at `http://localhost:3000`.

---

### New file: `docker-compose.local.yml`

A stripped-down compose file for offline use:
- GigaClaw on port 3000, Ollama reachable via `host.docker.internal:11434`
- `extra_hosts: host.docker.internal:host-gateway` for Linux GPU passthrough compatibility
- Optional **Ntfy** push notification service (LAN-only, no internet) behind `--profile notifications`

```bash
# Start with Ntfy notifications enabled:
docker compose -f docker-compose.local.yml --profile notifications up -d
```

---

### Mode-aware `gigaclaw init`

Re-running `npx gigaclaw init` on a local-mode project (detected via `GIGACLAW_MODE=local` in `.env`) now skips scaffolding GitHub Actions workflow files — keeping the project directory clean and free of cloud-only configuration that would never be used.

`docker-compose.local.yml` is added to `MANAGED_PATHS` and will be kept in sync on every `npx gigaclaw upgrade`.

---

## Files changed

| File | Change |
|---|---|
| `setup/setup.mjs` | Replaced with thin dispatcher (~50 lines) |
| `setup/setup-cloud.mjs` | New — original wizard, exported as `run()` |
| `setup/setup-local.mjs` | New — full local-mode wizard |
| `templates/docker-compose.local.yml` | New — offline compose template |
| `bin/cli.js` | `CLOUD_ONLY_PATHS`, mode-aware `init()`, `docker-compose.local.yml` in `MANAGED_PATHS` |

---

## Upgrade

```bash
npx gigaclaw@latest upgrade
```

Existing cloud-mode projects are unaffected — the cloud wizard is identical to previous versions.

---

**Full Changelog**: https://github.com/gignaati/gigaclaw/compare/v1.1.5...v1.2.0

**npm**: `npm install gigaclaw@1.2.0` · **Quick start**: `npx gigaclaw init`
