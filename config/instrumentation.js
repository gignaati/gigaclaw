/**
 * Next.js instrumentation hook for gigaclaw.
 * This file is loaded by Next.js on server start when instrumentationHook is enabled.
 *
 * Users should create an instrumentation.js in their project root that imports this:
 *
 *   export { register } from 'gigaclaw/instrumentation';
 *
 * Or they can re-export and add their own logic.
 */

let initialized = false;

export async function register() {
  // Only run on the server, and only once
  if (typeof window !== 'undefined' || initialized) return;
  initialized = true;

  // Skip database init and cron scheduling during `next build` —
  // these are runtime-only concerns that keep the event loop alive
  // and can cause build output corruption.
  if (process.argv.includes('build')) return;

  // Load .env from project root
  const dotenv = await import('dotenv');
  dotenv.config();

  // Set AUTH_URL from APP_URL so NextAuth redirects to the correct host (e.g., on sign-out)
  if (process.env.APP_URL && !process.env.AUTH_URL) {
    process.env.AUTH_URL = process.env.APP_URL;
  }

  // Validate auth secrets (required by Auth.js for session encryption and JWT signing)
  if (!process.env.AUTH_SECRET) {
    console.error('\n  ERROR: AUTH_SECRET is not set in your .env file.');
    console.error('  This is required for session encryption.');
    console.error('  Run "npm run setup" to generate it automatically, or add manually:');
    console.error('  openssl rand -base64 32\n');
    throw new Error('AUTH_SECRET environment variable is required');
  }
  if (!process.env.NEXTAUTH_SECRET) {
    // Fall back to AUTH_SECRET if NEXTAUTH_SECRET is not set
    process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
    console.warn('  WARN: NEXTAUTH_SECRET not set — using AUTH_SECRET as fallback.');
  }

  // Initialize auth database
  const { initDatabase } = await import('../lib/db/index.js');
  initDatabase();

  // Start cron scheduler — gated on ENABLE_CRON env var (default: false)
  // Bootstrap sets ENABLE_CRON=false initially, then enables after health check passes.
  if (process.env.ENABLE_CRON === 'true') {
    const { loadCrons } = await import('../lib/cron.js');
    loadCrons();
    const { startBuiltinCrons, setUpdateAvailable } = await import('../lib/cron.js');
    startBuiltinCrons();
    // Warm in-memory flag from DB
    try {
      const { getAvailableVersion } = await import('../lib/db/update-check.js');
      const stored = getAvailableVersion();
      if (stored) setUpdateAvailable(stored);
    } catch {}
    console.log('  Cron scheduler started (ENABLE_CRON=true)');
  } else {
    console.log('  Cron scheduler disabled (ENABLE_CRON != true)');
  }

  // Auto-detect mode and log it
  const mode = process.env.GIGACLAW_MODE || 'hybrid';
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const model = process.env.LLM_MODEL || 'unknown';
  console.log(`  Mode: ${mode} | Provider: ${provider} | Model: ${model}`);

  console.log('gigaclaw initialized');
}
