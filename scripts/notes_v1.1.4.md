Giga Bot v1.1.4 permanently resolves the Next.js / Turbopack middleware build error that affected users upgrading from pre-v1.1.3 installs. The fix is structural: `middleware.js` is now a managed file that is always overwritten on `init` and `upgrade`, and the `config` export has been removed from the package source so the re-export failure mode is impossible.

---

## What's Changed in v1.1.4

### 🐛 Bug Fixes

- Added `middleware.js` to `MANAGED_PATHS` in `bin/cli.js` — `npx gigaclaw init` and `npx gigaclaw upgrade` now always overwrite `middleware.js` with the correct template that defines `config` as a static inline literal
- Removed `config` export from `lib/auth/middleware.js` (the module exported as `gigaclaw/middleware`) — even if a user manually writes `export { config } from 'gigaclaw/middleware'`, there is nothing to re-export, making the failure mode structurally impossible

### How to fix if you are affected

Run `npx gigaclaw@latest upgrade` — this will automatically overwrite your `middleware.js` with the correct template. No manual file editing required.

---

**Full Changelog**: https://github.com/gignaati/gigaclaw/compare/v1.1.2...v1.1.4

**npm**: `npm install gigaclaw@1.1.4` · **Upgrade**: `npx gigaclaw@latest upgrade`
