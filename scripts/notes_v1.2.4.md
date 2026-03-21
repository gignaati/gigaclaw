# Giga Bot v1.2.4 — Cross-Platform QA Release

This release fixes three platform-specific bugs reported by Mac, Linux, and Windows users. All three bugs affected the first-time installation and login experience.

---

## Bug Fixes

### 🐛 Mac/Linux: `curl | bash` installer fails with `node: command not found`

**Root cause:** `curl | bash` runs a non-interactive, non-login shell. Shell init files (`~/.bashrc`, `~/.zshrc`, `/etc/profile`) are never sourced, so Node.js installed via Homebrew (`/opt/homebrew/bin`), nvm (`~/.nvm`), or asdf (`~/.asdf`) is missing from PATH.

**Fix:** `install.sh` now explicitly sources all three version managers before the Node.js check — the same pattern used by Homebrew, Rustup, and nvm itself:

```bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
[ -s "$HOME/.asdf/asdf.sh" ] && . "$HOME/.asdf/asdf.sh"
```

When Node.js is still not found after sourcing, the error now shows platform-specific install instructions instead of a bare error message.

---

### 🐛 Windows: Login shows "unexpected syntax" after successful account creation

**Root cause:** `AUTH_SECRET` was generated with `randomBytes(32).toString('base64')`, which produces `+`, `/`, and `=` characters. dotenv on Windows misparses unquoted values containing these characters — `+` becomes a space and `=` terminates the value — silently corrupting the JWT signing key. NextAuth cannot verify any session token and returns an opaque "unexpected syntax" error.

**Fix:** Switched to `base64url` encoding (RFC 4648 §5) in both `gigaclaw init` and `gigaclaw reset-auth`. `base64url` uses only `A-Z a-z 0-9 - _` — no special characters, no quoting needed.

**Action required for existing Windows users:** Run `npm run reset-auth` to regenerate your `AUTH_SECRET`, then restart the server. All existing sessions will be invalidated.

---

### 🐛 Windows: `npm install`, `npm run build`, `git` commands fail with `ENOENT`

**Root cause:** All `execSync` calls in `bin/cli.js` were missing `shell: true`. On Windows, `npm`, `npx`, `git`, and `docker` are `.cmd` shims that only resolve when a shell is involved. Without `shell: true`, Node.js attempts to execute them as binaries directly, which fails with `ENOENT`.

**Fix:** Added `shell: true` to all 13 `execSync` calls that invoke external commands in `bin/cli.js`.

---

## Regression Tests

12/12 tests pass. Run with:

```bash
npm run test:tty
```

Test coverage: syntax validation, `base64url` encoding (no `+/=` chars confirmed), Homebrew/nvm/asdf PATH block presence, `shell: true` coverage across all external command calls, and all setup file syntax checks.

---

## Upgrade

```bash
npx gigaclaw@latest upgrade
```

Windows users with the login bug must also run:

```bash
npm run reset-auth
```

---

## Files Changed

| File | Change |
|---|---|
| `install.sh` | Homebrew/nvm/asdf PATH sourcing, improved Node.js error messages |
| `bin/cli.js` | `base64url` for AUTH_SECRET generation, `shell: true` on all execSync calls |
| `CHANGELOG.md` | v1.2.4 entry with full root cause analysis |
