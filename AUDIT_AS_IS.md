# GigaClaw AS-IS Codebase Audit Report

**Date**: 2026-03-21
**Version on disk**: 1.5.1
**Auditor**: Claude Opus 4.6 (automated, 9-phase systematic audit)
**Scope**: Full codebase — 261 files across 81 JS, 46 JSX, 19 MJS, 48 MD, 16 JSON, 12 YML, 12 SH, 5 SQL, 1 PS1, 1 CSS

---

## A. Codebase Snapshot

### Version
| Surface | Version |
|---------|---------|
| `package.json` | `1.5.1` |
| Latest git tag | `v1.5.1` (commit `0cedd10`) |

### Architecture Summary
Event Handler (Next.js) creates `job/*` branches → GitHub Actions runs Docker agent → task executed → PR created → auto-merge → notification. The npm package exports 15 module paths covering API routes, auth, chat UI, code workspaces, DB, and middleware.

### Build Pipeline
- **esbuild** compiles 36 JSX files (26 in `lib/chat/components/`, 8 in `lib/chat/components/ui/`, 2 in `lib/code/`) to ESM `.js` files
- `npm run build` runs esbuild; `prepublishOnly` calls `npm run build`
- Publish pipeline: `regression-tests` → `publish-staging` → `build-containers` (4 Docker images) → `promote` → `release-notes` → `github-release` → `update-changelog`

### Test Coverage
- **Regression suite**: 12 tests in `scripts/test-tty-regression.mjs` (string presence checks + functional TTY tests that are **skipped on CI**)
- **Unit/integration tests**: **None**. `npm test` outputs "No tests yet" and exits 0
- **No test framework** installed (no jest, vitest, mocha in devDependencies)

### Directory Structure
```
api/                 → GET/POST route handlers (gigaclaw/api)
bin/                 → CLI (gigaclaw init/setup/upgrade/diff/reset)
config/              → Next.js config wrapper + instrumentation hook
docs/                → 14 markdown documentation files
drizzle/             → 5 generated SQLite migrations
lib/                 → Core library: ai/, auth/, channels/, chat/, code/, db/, tools/, utils/
scripts/             → Release notes generator + regression tests + archived notes
setup/               → Interactive setup wizard (cloud/local/telegram modes)
templates/           → 73 files scaffolded to user projects via `gigaclaw init`
.github/workflows/   → claude.yml, publish-npm.yml, setup-npm (snippet)
```

---

## B. Critical Issues (P0) — Blocks Users Right Now

### P0-1: Event Handler Dockerfile installs wrong npm package
- **File**: `templates/docker/event-handler/Dockerfile:15`
- **Code**: `npm install --no-save gigabot@$(node -p "require('./package.json').version")`
- **Impact**: Docker builds install the non-existent/wrong `gigabot` package instead of `gigaclaw`. Event handler containers will fail to start.
- **Fix**: Replace `gigabot` with `gigaclaw`

### P0-2: CSS @source references wrong package name
- **File**: `templates/app/globals.css:3`
- **Code**: `@source "../node_modules/gigabot/lib/**/*.{js,jsx}"`
- **Impact**: Tailwind CSS will not scan the actual package's component files. All utility classes used by gigaclaw components will be purged, resulting in broken/unstyled UI.
- **Fix**: Replace `gigabot` with `gigaclaw`

### P0-3: Missing `next-themes` dependency
- **File**: `lib/chat/components/sidebar-user-nav.jsx` imports `useTheme` from `next-themes`
- **Impact**: `next-themes` is not listed in `dependencies` or `peerDependencies`. Users who don't independently install `next-themes` will get a runtime module-not-found error when loading the sidebar.
- **Fix**: Add `next-themes` to `peerDependencies`

### P0-4: WebSocket proxy missing workspace ownership check
- **File**: `lib/code/ws-proxy.js`
- **Impact**: Any authenticated user can proxy into **any** workspace's Docker container if they know the workspace ID. The `isAuthenticated` function only checks `!!token?.sub` — it doesn't verify the workspace belongs to the user.
- **Fix**: Return user ID from `isAuthenticated()`, filter `getCodeWorkspaceById` by `userId`

---

## C. High-Priority Issues (P1) — Causes Friction or Confusion

### P1-1: 60+ legacy "Giga Bot" / "gigabot" references remain
The v1.4.0 rename was incomplete. The following files still contain the old brand name:

| Category | Files affected | Count |
|----------|---------------|-------|
| README.md | H1 heading + 9 more lines | ~10 |
| templates/CLAUDE.md.template | 11 lines with `gigabot` refs and dead `gignaati/gigabot` URLs | ~11 |
| templates/app/layout.js | Title, description, keywords, OpenGraph | 5 |
| templates/.env.example | Header, CLI command, env vars | 4 |
| templates/config/SOUL.md | Identity lines | 3 |
| templates/middleware.js | Comment header | 1 |
| setup/setup.mjs | Intro + prompt text | 2 |
| setup/setup-local.mjs | 8 user-facing strings + `GIGABOT_MODE` env var | 8 |
| setup/lib/providers.mjs | Comments | 2 |
| scripts/*.mjs | Test suite name + release notes generator | 4 |
| .github/workflows/publish-npm.yml | GitHub Release title | 1 |
| CHANGELOG.md | Historical entry | 1 |
| Archived release notes (scripts/notes_v1.*.md) | Headers | 8 |

### P1-2: Legacy `tpb_` API key prefix
- **File**: `lib/db/api-keys.js:6`
- **Code**: `KEY_PREFIX = 'tpb_'` ("tpb" = "ThePopeBot")
- **Impact**: Every user-generated API key visibly carries a legacy brand prefix. Also documented in `templates/CLAUDE.md.template:220`.
- **Fix**: Rename to `gcl_` with migration for existing keys

### P1-3: Legacy `GIGABOT_*` environment variable names
- `setup/setup-local.mjs:257` → `GIGABOT_MODE`
- `templates/.env.example:100` → `GIGABOT_VERSION`
- `scripts/test-tty-regression.mjs` → `GIGABOT_SKIP_SETUP`, `GIGABOT_DIR`
- **Impact**: Inconsistent with the `GIGACLAW_*` namespace. Users see mixed env var naming.

### P1-4: Shell injection in `upgrade()` command
- **File**: `bin/cli.js:535, 578`
- **Code**: User-controlled `tag` argument interpolated into `execSync` with `shell: true`
- **Impact**: `gigaclaw upgrade "latest; rm -rf /"` would execute arbitrary shell commands
- **Fix**: Use `execFileSync` with argument arrays, or validate `tag` against `/^[a-zA-Z0-9._-]+$/`

### P1-5: `upgrade()` error paths return instead of exiting
- **File**: `bin/cli.js:554-557, 572`
- **Impact**: Failed `git commit` or `git pull --rebase` during upgrade causes `upgrade()` to return successfully. Process exits 0, masking the failure from CI/scripts.
- **Fix**: Replace `return` with `process.exit(1)`

### P1-6: `next-auth` peer dependency pinned to beta
- **File**: `package.json` peerDependencies
- **Code**: `"next-auth": "^5.0.0-beta.30"`
- **Impact**: Caret range on pre-release won't match stable `5.0.0`. If next-auth 5.0.0 stable has shipped, users cannot use it.
- **Fix**: Update to `"^5.0.0"` or `">=5.0.0-beta.30"`

### P1-7: No website changelog auto-update
- **File**: `.github/workflows/publish-npm.yml`
- **Impact**: `update-changelog` job only updates `CHANGELOG.md` in git. There is no job that syncs to `gigaclaw.gignaati.com`. Website changelog may drift from actual releases.

---

## D. Tech Debt (P2) — Won't Break But Slows Development

### P2-1: Zero unit/integration test coverage
- `npm test` is `echo "No tests yet" && exit 0`
- No test framework installed. Only the 12-test regression suite exists (string-presence checks).

### P2-2: TTY regression tests skip functional checks on CI
- `scripts/test-tty-regression.mjs` Tests 7 and 9 (the only functional TTY tests) have `skipOnCI: true`
- Only string-inclusion tests run in the publish gate

### P2-3: Unused dependency: `class-variance-authority`
- Listed in `package.json` but never imported anywhere in the codebase

### P2-4: Inconsistent Ollama retry counts
- `install.sh` and `install.ps1`: 3 retries
- `setup/setup-local.mjs`: 5 retries

### P2-5: No installer rollback/cleanup
- Neither `install.sh` nor `install.ps1` has cleanup logic if a step fails mid-scaffold
- Failed `npm install` leaves a partially-scaffolded directory

### P2-6: Silent error swallowing in CLI
- `bin/cli.js:139` — silent `catch {}` on malformed `package.json`
- `bin/cli.js:342` — silent `catch {}` on `.env` update failure
- `bin/cli.js:473,483` — `setup`/`setup-telegram` catch blocks exit(1) without printing the error

### P2-7: Shell injection in `diff()` command
- `bin/cli.js:441` — user-provided `filePath` in template string with `shell: true`
- Lower risk (local-only) but should use `execFileSync`

### P2-8: `MANAGED_PATHS` incomplete
- `bin/cli.js:25-37` — Only `docker/event-handler/` is managed from Docker subdirs
- Missing: `docker/claude-code-job/`, `docker/claude-code-workspace/`, `docker/pi-coding-agent-job/`

### P2-9: Node.js engine floor includes EOL version
- `"node": ">=18.0.0"` — Node 18 reached EOL April 2025. Should bump to `>=20.0.0`

### P2-10: `next` peer dep has no upper bound
- `"next": ">=15.5.12"` — will accept Next.js 16+, which could introduce breaking changes

### P2-11: `lib/code/` not documented in CLAUDE.md
- Code workspaces module is exported via 3 package paths but not mentioned in project architecture docs

### P2-12: `setup-npm` file in `.github/workflows/` without `.yml` extension
- Not a valid workflow. Appears to be a reference snippet. Clutters the workflows directory.

### P2-13: Legacy upstream references in documentation
- `docs/HOW_TO_BUILD_SKILLS.md` and `docs/NPM.md` reference `badlogic/pi-skills`
- `templates/skills/README.md` has 7 references to `github.com/badlogic/pi-skills`

---

## E. Dependency Health Matrix

### Dependencies (31 packages)

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| `@ai-sdk/react` | `^2.0.0` | **breaking-risk** | Major v2 bump from v1 |
| `@clack/prompts` | `^0.10.0` | ok | |
| `@grammyjs/parse-mode` | `^2.2.0` | ok | |
| `@langchain/anthropic` | `^1.3.17` | ok | v1 is current stable |
| `@langchain/core` | `^1.1.24` | ok | |
| `@langchain/google-genai` | `^2.1.18` | **breaking-risk** | v2 major |
| `@langchain/langgraph` | `^1.1.4` | ok | |
| `@langchain/langgraph-checkpoint-sqlite` | `^1.0.1` | ok | |
| `@langchain/openai` | `^1.2.7` | ok | |
| `@xterm/addon-fit` | `^0.10.0` | ok | |
| `@xterm/addon-search` | `^0.15.0` | ok | |
| `@xterm/addon-serialize` | `^0.13.0` | ok | |
| `@xterm/addon-web-links` | `^0.11.0` | ok | |
| `@xterm/xterm` | `^5.5.0` | ok | |
| `ai` | `^5.0.0` | **breaking-risk** | Vercel AI SDK v5 major rewrite |
| `bcrypt-ts` | `^6.0.0` | ok | |
| `better-sqlite3` | `^12.6.2` | ok | |
| `chalk` | `^5.3.0` | ok | |
| `class-variance-authority` | `^0.7.0` | **unused** | Never imported |
| `clsx` | `^2.0.0` | ok | |
| `dotenv` | `^16.3.1` | ok | |
| `drizzle-orm` | `^0.44.0` | ok | |
| `grammy` | `^1.39.3` | ok | |
| `lucide-react` | `^0.400.0` | ok | |
| `node-cron` | `^3.0.3` | ok | |
| `open` | `^10.0.0` | ok | |
| `streamdown` | `^2.2.0` | ok | |
| `tailwind-merge` | `^3.0.0` | ok | |
| `uuid` | `^9.0.0` | ok | |
| `ws` | `^8.19.0` | ok | |
| `zod` | `^4.3.6` | **breaking-risk** | v4 ground-up rewrite from v3 |

### Peer Dependencies

| Package | Version | Status |
|---------|---------|--------|
| `next` | `>=15.5.12` | ok (but no upper bound) |
| `next-auth` | `^5.0.0-beta.30` | **beta** — won't match stable 5.0.0 |
| `react` | `>=19.0.0` | ok |
| `react-dom` | `>=19.0.0` | ok |

### Missing from package.json
| Package | Imported in | Type needed |
|---------|------------|-------------|
| `next-themes` | `lib/chat/components/sidebar-user-nav.jsx` | peerDependency |

### Dev Dependencies

| Package | Version | Status |
|---------|---------|--------|
| `drizzle-kit` | `^0.31.9` | ok |
| `esbuild` | `^0.27.3` | ok |

---

## F. Security Surface

### Authentication Flow
- **NextAuth v5** with Credentials provider (email + bcrypt password hash)
- JWT stored in httpOnly cookies, encrypted with `AUTH_SECRET` (base64url, 32 random bytes)
- First visit creates admin account via `setupAdmin()` server action
- API routes authenticated via `x-api-key` header (SHA-256 hashed, timing-safe comparison)
- Browser UI uses Server Actions with `requireAuth()` session validation
- Chat streaming endpoint at `/stream/chat` uses session auth

### Hardcoded Secrets Patterns
- **None found**. All secrets are loaded from environment variables or generated at runtime.
- `AUTH_SECRET` generation uses `crypto.randomBytes(32).toString('base64url')` — correct.

### eval() / Dynamic Import with User Input
- **No `eval()`** found in the codebase
- Dynamic imports in `lib/ai/model.js` use hardcoded package names (e.g., `import('@langchain/openai')`) based on provider enum — not user input. Safe.

### Shell Injection Vectors
- `bin/cli.js:535,578` — `upgrade()` interpolates user-controlled `tag` into `execSync` with `shell: true`
- `bin/cli.js:441` — `diff()` interpolates `filePath` into `execSync` with `shell: true`
- Both are CLI commands (local-only, not remote exploitable), but still poor practice

### Authorization Gaps
- **P0-4**: `lib/code/ws-proxy.js` authenticates users but does not verify workspace ownership. Any authenticated user can access any workspace container.

---

## G. Positive Findings — What Is Done Well

1. **Robust publish pipeline**: 8-job dependency chain with regression gate, staging → promote pattern, automatic rollback on Docker build failure, LLM-generated release notes, and automated GitHub releases. This is a well-architected CI/CD system.

2. **Defensive `next.config.mjs` template**: The try/catch wrapper around `import('gigaclaw/config')` with user-friendly error messaging and specific error code detection (`ERR_MODULE_NOT_FOUND`) is excellent DX for the v1.5.1 Node.js compatibility fix.

3. **Proper middleware config pattern**: The static inline `config` export in `templates/middleware.js` with a clear explanatory comment about why it can't be re-exported from the package shows good understanding of Next.js internals.

4. **Clean auth separation**: Server Actions for browser UI (session cookies) vs `/api` routes for external callers (API keys) vs dedicated streaming endpoint — well-structured with clear documentation.

5. **Database architecture**: Drizzle ORM over better-sqlite3 with WAL mode, configurable DB path via `DATABASE_PATH`, singleton pattern, auto-migration on startup, and a clear schema → generate → migrate workflow. The camelCase-to-snake_case convention is well-documented.

6. **Template protection during upgrades**: The `MANAGED_PATHS` system ensures `gigaclaw upgrade` only overwrites package-managed files and never touches user's `config/` directory. The `diff` command lets users inspect changes before applying.

7. **Multi-platform installer coverage**: `install.ps1` covers 8 Node.js manager PATH locations + dynamic nvm subdirectory scanning. The TTY guard in `install.sh` is correctly conditional on both `[ ! -t 0 ]` and `[ -e /dev/tty ]`.

8. **Action dispatch system**: Clean abstraction over agent/command/webhook action types, shared between cron jobs and webhook triggers, with consistent configuration schema.

9. **Export submenu with format support**: Chat export supports JSON, Markdown, and plain text via a clean shared `formatChatExport()` helper with proper auth gating and ownership checks.

10. **Custom DropdownMenu implementation**: Avoids Radix dependency while preventing `<button><button>` hydration errors through span-based trigger with role="button". The `asChild` prop is correctly consumed and never reaches DOM elements.

---

## H. Recommended Next Release (v1.6.0) — Priority-Ordered Backlog

| Priority | Title | Effort | Files Affected |
|----------|-------|--------|---------------|
| **P0** | Fix Dockerfile to install `gigaclaw` not `gigabot` | S | `templates/docker/event-handler/Dockerfile` |
| **P0** | Fix CSS @source to reference `gigaclaw` not `gigabot` | S | `templates/app/globals.css` |
| **P0** | Add `next-themes` to peerDependencies | S | `package.json` |
| **P0** | Add workspace ownership check to WebSocket proxy | S | `lib/code/ws-proxy.js` |
| **P1** | Complete brand rename: replace 60+ "Giga Bot"/"gigabot" references | M | ~25 files (README, templates, setup, scripts) |
| **P1** | Rename `tpb_` API key prefix to `gcl_` | M | `lib/db/api-keys.js`, `templates/CLAUDE.md.template`, migration |
| **P1** | Rename `GIGABOT_*` env vars to `GIGACLAW_*` | M | `setup/setup-local.mjs`, `templates/.env.example`, `scripts/test-tty-regression.mjs` |
| **P1** | Sanitize CLI `upgrade()` against shell injection | S | `bin/cli.js` (use `execFileSync`) |
| **P1** | Fix `upgrade()` error paths to `process.exit(1)` | S | `bin/cli.js:554-557, 572` |
| **P1** | Update `next-auth` peer dep to include stable range | S | `package.json` |
| **P1** | Add website changelog sync to publish pipeline | M | `.github/workflows/publish-npm.yml` |
| **P2** | Remove unused `class-variance-authority` dependency | S | `package.json` |
| **P2** | Add unit test framework and initial test suite | L | New `tests/` directory, package.json |
| **P2** | Harmonize Ollama retry counts (3 vs 5) | S | `setup/setup-local.mjs` |
| **P2** | Add installer rollback/cleanup on failure | M | `install.sh`, `install.ps1` |
| **P2** | Expand `MANAGED_PATHS` to cover all Docker subdirs | S | `bin/cli.js` |
| **P2** | Bump Node.js engine floor to `>=20.0.0` | S | `package.json` |
| **P2** | Cap `next` peer dep at `<17` | S | `package.json` |
| **P2** | Document `lib/code/` in CLAUDE.md | S | `CLAUDE.md` |
| **P2** | Clean up `setup-npm` snippet from workflows dir | S | `.github/workflows/setup-npm` |
| **P2** | Update legacy `badlogic/pi-skills` references in docs | S | `docs/HOW_TO_BUILD_SKILLS.md`, `docs/NPM.md`, `templates/skills/README.md` |
| **P2** | Make functional TTY tests run on CI | M | `scripts/test-tty-regression.mjs` |

---

*Generated by Claude Opus 4.6 — systematic 9-phase audit of gigaclaw v1.5.1*
