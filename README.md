<div align="center">

# GigaClaw

### Autonomous AI Agent Platform — Powered by Gignaati

[![npm version](https://img.shields.io/npm/v/gigaclaw?color=000&labelColor=000&logo=npm&label=gigaclaw)](https://www.npmjs.com/package/gigaclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-000?labelColor=000)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/gignaati/gigaclaw?color=000&labelColor=000)](https://github.com/gignaati/gigaclaw/stargazers)
[![Made in India](https://img.shields.io/badge/Made%20in-India-FF9933?labelColor=000)](https://www.gignaati.com)

**Build, deploy, and run autonomous AI agents 24/7.**  
India-first. Edge-native. Zero vendor lock-in.

[Website](https://www.gignaati.com) · [Documentation](https://github.com/gignaati/gigaclaw/wiki) · [Issues](https://github.com/gignaati/gigaclaw/issues) · [Discussions](https://github.com/gignaati/gigaclaw/discussions)

</div>

---

## What is GigaClaw?

GigaClaw is a self-hosted, autonomous AI agent platform. You deploy it to your own server or VPS, and it runs 24/7 — responding to messages, executing scheduled jobs, handling webhooks, writing code, managing files, and completing complex multi-step tasks.

It is built on a two-layer architecture:

- **Event Handler** — A Next.js server that handles real-time chat (web UI + Telegram), manages your agent's configuration, and creates jobs for the agent to execute.
- **Agent Engine** — A Docker container that runs your agent jobs using GitHub Actions or a local Docker daemon. The agent can write code, run shell commands, browse the web, and interact with GitHub.

GigaClaw is the only autonomous agent platform with **native PragatiGPT support** — India's indigenous Small Language Model for edge deployment, delivering 100% data privacy and zero foreign cloud dependency.

---

## One-Line Install

### Linux / macOS
```bash
curl -fsSL https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.sh | bash
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.ps1 | iex
```

### All Platforms (npm / npx)
```bash
# Create a new GigaClaw project
mkdir my-gigaclaw && cd my-gigaclaw
npx gigaclaw@latest init

# Then run the interactive setup wizard
npm run setup
```

> **Prerequisites:** [Node.js 18+](https://nodejs.org), [Docker](https://docs.docker.com/get-docker/), [Git](https://git-scm.com)

---

## Quick Start (5 Steps)

**Step 1 — Create a new GitHub repository** for your agent (e.g., `my-gigaclaw`).

**Step 2 — Install GigaClaw** into a local folder with the same name:
```bash
mkdir my-gigaclaw && cd my-gigaclaw
npx gigaclaw@latest init
npm install
```

**Step 3 — Run the setup wizard:**
```bash
npm run setup
```
The wizard will ask for:
- Your GitHub Personal Access Token
- Your public URL (domain or ngrok URL)
- Your LLM provider and API key (Claude, GPT, Gemini, PragatiGPT, or Ollama)

**Step 4 — Start your agent:**
```bash
docker compose up -d
```

**Step 5 — Chat with your agent** at your APP_URL.

---

## Supported LLM Providers

GigaClaw supports **6 LLM providers** — more than any other self-hosted agent platform:

| Provider | Description | Data Privacy |
|---|---|---|
| **PragatiGPT** | Gignaati's India-first SLM — edge-native, on-premise | 100% — no foreign cloud |
| **Ollama** | Run any open-source model locally (Llama, Mistral, Qwen, Phi) | 100% — fully local |
| **Claude (Anthropic)** | claude-opus-4, claude-sonnet-4, claude-haiku-4 | Anthropic's servers |
| **GPT (OpenAI)** | gpt-5.2, gpt-4o, o4-mini | OpenAI's servers |
| **Gemini (Google)** | gemini-3.1-pro, gemini-2.5-flash | Google's servers |
| **Custom API** | Any OpenAI-compatible endpoint (vLLM, LM Studio, Together AI) | Depends on endpoint |

Set your provider in `.env`:
```bash
LLM_PROVIDER=pragatigpt   # India-first, edge-native
LLM_PROVIDER=ollama       # Fully local, zero cloud
LLM_PROVIDER=anthropic    # Claude (default)
LLM_PROVIDER=openai       # GPT
LLM_PROVIDER=google       # Gemini
LLM_PROVIDER=custom       # Any OpenAI-compatible API
```

---

## Features

### Agent Capabilities
- **Web Chat** — Chat with your agent at your APP_URL
- **Telegram** — Connect a Telegram bot with `npm run setup-telegram`
- **Scheduled Jobs** — Cron-based recurring tasks via `config/CRONS.json`
- **Webhook Triggers** — POST to `/api/create-job` to trigger jobs programmatically
- **Code Workspace** — Full terminal and code editor in the browser
- **File Uploads** — Upload images, PDFs, and text files to the chat

### Agent Tools
- **Code execution** — Write and run code in any language
- **Shell commands** — Execute terminal commands
- **Web search** — Search the internet for up-to-date information
- **GitHub integration** — Create PRs, manage issues, push commits
- **File system** — Read, write, and manage files in the repository

### Infrastructure
- **Docker Compose** — One-command deployment with Traefik reverse proxy
- **Auto SSL** — Let's Encrypt certificates via Traefik
- **GitHub Actions** — Agent jobs run in isolated Docker containers
- **Auto-merge** — Agent can merge its own PRs after review
- **Hot reload** — Push to `main` triggers automatic rebuild and restart

### GigaClaw Exclusive Features
- **PragatiGPT** — India's indigenous SLM for edge deployment
- **Ollama** — Run any open-source model with zero cloud dependency
- **Multi-LLM routing** — Different LLMs for chat vs. agent jobs
- **Per-job LLM override** — Specify `llm_provider` and `llm_model` per cron job

---

## CLI Commands

```bash
npx gigaclaw init                              # Scaffold or update project files
npx gigaclaw setup                            # Run interactive setup wizard
npx gigaclaw setup-telegram                   # Configure Telegram bot
npx gigaclaw upgrade [@beta|version]          # Upgrade to latest version
npx gigaclaw reset-auth                       # Regenerate AUTH_SECRET
npx gigaclaw reset [file]                     # Restore a template file
npx gigaclaw diff [file]                      # Show differences vs. templates
npx gigaclaw set-agent-secret <KEY> [VALUE]   # Set GitHub secret (AGENT_ prefix)
npx gigaclaw set-agent-llm-secret <KEY> [VALUE] # Set LLM secret (AGENT_LLM_ prefix)
npx gigaclaw set-var <KEY> [VALUE]            # Set GitHub repository variable
```

---

## Configuration Files

These files in `config/` define your agent's personality and behavior. They are **yours to customize** — GigaClaw will never overwrite them:

| File | Purpose |
|---|---|
| `SOUL.md` | Your agent's identity, personality, and values |
| `JOB_PLANNING.md` | How your agent plans and breaks down jobs |
| `JOB_AGENT.md` | Instructions for executing jobs |
| `CRONS.json` | Scheduled recurring jobs |
| `TRIGGERS.json` | Webhook trigger definitions |
| `HEARTBEAT.md` | Tasks for the periodic heartbeat cron |

---

## Updating

```bash
npx gigaclaw upgrade          # Latest stable
npx gigaclaw upgrade @beta    # Latest beta
npx gigaclaw upgrade 1.2.72   # Specific version
```

---

## Deployment

GigaClaw runs on any Linux server with Docker. Recommended:

| Provider | Spec | Monthly Cost |
|---|---|---|
| Hetzner CX22 | 2 vCPU, 4 GB RAM | ~€4 |
| DigitalOcean Droplet | 2 vCPU, 4 GB RAM | ~$24 |
| AWS EC2 t3.small | 2 vCPU, 2 GB RAM | ~$15 |
| Your own hardware | Any Linux machine | ₹0 |

For local development, use [ngrok](https://ngrok.com) to expose your machine:
```bash
ngrok http 80
# Then update APP_URL: npx gigaclaw set-var APP_URL https://your-url.ngrok.io
```

---

## Privacy & Legal

- [Privacy Policy](https://www.gignaati.com/privacy-policy)
- [Terms of Service](https://www.gignaati.com/terms-of-service)
- [Security Policy](SECURITY.md)
- [License](LICENSE) — MIT

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

---

## Support

- **GitHub Issues:** [github.com/gignaati/gigaclaw/issues](https://github.com/gignaati/gigaclaw/issues)
- **Discussions:** [github.com/gignaati/gigaclaw/discussions](https://github.com/gignaati/gigaclaw/discussions)
- **Email:** support@gignaati.com
- **Website:** [www.gignaati.com](https://www.gignaati.com)

---

<div align="center">

**Built with care by [Gignaati](https://www.gignaati.com) — India's Edge AI Ecosystem**

[Privacy Policy](https://www.gignaati.com/privacy-policy) · [Terms of Service](https://www.gignaati.com/terms-of-service) · [Security](SECURITY.md)

</div>
