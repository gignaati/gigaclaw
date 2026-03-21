# Pre-Release Versions

Pre-release builds (beta, alpha, rc) are published to separate npm dist-tags. They won't be installed by normal `npm update` or `gigaclaw init` — you have to opt in explicitly.

**Step 1** — Scaffold a new project with the pre-release version:

```bash
mkdir my-agent && cd my-agent
npx gigaclaw@beta init
```

**Step 2** — Run the setup wizard:

```bash
npm run setup
```

**Step 3** — Start your agent:

```bash
docker compose up -d
```

\*\* To install a specific version, replace `@beta` with the exact version (e.g., `npx gigaclaw@1.3.0-beta.1 init`). Run `npm info gigaclaw` to see all available versions.

Pre-releases may contain breaking changes or incomplete features. Use them for testing and feedback — not production agents.
