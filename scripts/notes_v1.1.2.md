Giga Bot v1.1.2 is a branding cleanup and stability release. It completes GigaBot branding across all compiled components, corrects the support URL to `gigabot.gignaati.com`, and fixes a React hydration error on the Swarm page caused by reading `localStorage` during SSR.

---

## What's Changed in v1.1.2

### 🐛 Bug Fixes

- Completed GigaBot branding across all compiled components including `app-sidebar.js` — all legacy identifiers replaced with GigaBot
- Corrected support URL from `www.gignaati.com` to `https://gigabot.gignaati.com` in `app-sidebar.jsx` and compiled output
- Fixed Swarm page React hydration error caused by reading `localStorage` during SSR — replaced direct access with an SSR-safe `useEffect` pattern

---

**Full Changelog**: https://github.com/gignaati/gigabot/compare/v1.1.1...v1.1.2

**npm**: `npm install gigabot@1.1.2` · **Upgrade**: `npx gigabot@latest upgrade`
