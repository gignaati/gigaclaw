/**
 * Next.js config wrapper for gigabot.
 * Enables instrumentation hook for cron scheduling on server start.
 *
 * Usage in user's next.config.mjs:
 *   import { withGigabot } from 'gigabot/config';
 *   export default withGigabot({});
 *
 * @param {Object} nextConfig - User's Next.js config
 * @returns {Object} Enhanced Next.js config
 */
export function withGigabot(nextConfig = {}) {
  return {
    ...nextConfig,
    distDir: process.env.NEXT_BUILD_DIR || '.next',
    env: {
      ...nextConfig.env,
      NEXT_PUBLIC_CODE_WORKSPACE: process.env.CLAUDE_CODE_OAUTH_TOKEN && process.env.BETA ? 'true' : '',
    },
    serverExternalPackages: [
      ...(nextConfig.serverExternalPackages || []),
      'better-sqlite3',
      'drizzle-orm',
    ],
  };
}
