Giga Bot v1.1.2 is a branding cleanup and stability release. It completes GigaClaw branding across all compiled components, corrects the support URL to `gigaclaw.gignaati.com`, and fixes a React hydration error on the Swarm page caused by reading `localStorage` during SSR.

---

## What's Changed in v1.1.2

### 🐛 Bug Fixes

- Completed GigaClaw branding across all compiled components including `app-sidebar.js` — all legacy identifiers replaced with GigaClaw
- Corrected support URL from `www.gignaati.com` to `https://gigaclaw.gignaati.com` in `app-sidebar.jsx` and compiled output
- Fixed Swarm page React hydration error caused by reading `localStorage` during SSR — replaced direct access with an SSR-safe `useEffect` pattern

---

**Full Changelog**: https://github.com/gignaati/gigaclaw/compare/v1.1.1...v1.1.2

**npm**: `npm install gigaclaw@1.1.2` · **Upgrade**: `npx gigaclaw@latest upgrade`
