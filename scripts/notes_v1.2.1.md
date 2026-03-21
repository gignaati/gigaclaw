# Giga Bot v1.2.1 — Frictionless Onboarding Fixes

This patch release addresses three onboarding friction points reported by a real user during their first install of v1.2.0 Local Mode. The install-to-running experience is now fully frictionless.

---

## Bug Report Reproduced

The user ran the one-command installer and hit the following issues in sequence:

1. `npm run setup` failed with `npm error Missing script: "setup"` — because they were still in the **parent directory** after the installer finished
2. `docker compose up -d` failed with `pull access denied for gignaati/gigaclaw` — because the compose file referenced a **private Docker image** that requires registry login
3. Even after the wizard completed, Docker was launched **blindly** without checking if it was available or if the user wanted to use it

---

## Fixes

### Fix 1 — `install.sh`: Auto-cd and auto-launch setup

**Before:** The installer printed `cd my-gigaclaw && npm run setup` as a manual instruction. Users who missed this ran `npm run setup` from the wrong directory.

**After:** The installer now automatically `cd`s into the project directory and runs `npm run setup` as the final step. The user experience is now a single command from start to finish:

```bash
curl -fsSL https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.sh | bash
# → scaffolds project, installs deps, launches setup wizard automatically
```

### Fix 2 — `docker-compose.local.yml`: Build from local source

**Before:** The compose file used `image: gignaati/gigaclaw:event-handler-${GIGACLAW_VERSION}` — a private image that requires `docker login` and does not exist on Docker Hub publicly.

**After:** The compose file now uses `dockerfile_inline` to build GigaClaw directly from the local source code using the official `node:20-alpine` image. **No registry login required.**

```yaml
build:
  context: .
  dockerfile_inline: |
    FROM node:20-alpine
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    EXPOSE 3000
    CMD ["npm", "run", "dev"]
```

First build: ~2–3 minutes. Subsequent starts: instant (layer cache).

### Fix 3 — `setup-local.mjs` Step 5: Interactive start selector

**Before:** Step 5 ran `docker compose up -d` unconditionally — no Docker check, no user choice, no fallback.

**After:** Step 5 now:
- Checks if Docker is available (`docker info`) before offering it
- Presents three options:
  - **`npm run dev`** (recommended — no Docker needed, fastest to start)
  - **`docker compose`** (only shown as viable if Docker is detected)
  - **Start later** — just show the commands
- Uses `--build` flag so Docker always builds from local source, never pulls
- Falls back gracefully with clear instructions if Docker fails

---

## Upgrade

```bash
npx gigaclaw@latest upgrade
```

Or for new installs:

```bash
curl -fsSL https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.sh | bash
```

---

**Full changelog:** [CHANGELOG.md](https://github.com/gignaati/gigaclaw/blob/main/CHANGELOG.md)
**npm:** [gigaclaw@1.2.1](https://www.npmjs.com/package/gigaclaw/v/1.2.1)
