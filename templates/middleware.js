/**
 * Giga Bot — Middleware
 * Powered by Gignaati | https://gignaati.com
 *
 * Next.js requires the `config` export to be a static literal object defined
 * directly in this file. It cannot be re-exported from another module because
 * Turbopack/Webpack statically analyses it at compile time.
 *
 * The `middleware` function is imported from the gigabot package and handles:
 *   - Authentication checks (redirects unauthenticated users to /login)
 *   - Stale session cookie cleanup on AUTH_SECRET rotation
 *   - Skipping auth for /api routes, static assets, and the /login page itself
 */
export { middleware } from 'gigabot/middleware';

/**
 * Route matcher config — must be a static literal object in this file.
 * Excludes Next.js internals (_next/*), Turbopack HMR assets, and favicon.ico
 * from middleware processing to avoid interfering with static asset delivery.
 */
export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
