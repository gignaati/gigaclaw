/**
 * Health check endpoint — /api/health
 *
 * Validates:
 *   1. Auth configuration (AUTH_SECRET, NEXTAUTH_SECRET present)
 *   2. LLM availability (cloud key or Ollama reachable)
 *   3. Database initialized
 *   4. Server readiness
 *
 * Returns JSON with status: 'healthy' | 'degraded' | 'unhealthy'
 * and details for each subsystem.
 */

import { checkOllamaHealth, checkCloudProviderConfig } from '../ai/provider-health.js';

export async function handleHealthCheck() {
  const checks = {};
  let overallStatus = 'healthy';

  // 1. Auth configuration
  const authSecret = process.env.AUTH_SECRET;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  if (authSecret && nextAuthSecret) {
    checks.auth = { status: 'ok', message: 'Auth secrets configured' };
  } else {
    checks.auth = {
      status: 'fail',
      message: `Missing: ${[
        !authSecret && 'AUTH_SECRET',
        !nextAuthSecret && 'NEXTAUTH_SECRET',
      ].filter(Boolean).join(', ')}`,
    };
    overallStatus = 'unhealthy';
  }

  // JWT secret (used by ws-proxy)
  if (jwtSecret) {
    checks.jwt = { status: 'ok', message: 'JWT secret configured' };
  } else {
    checks.jwt = { status: 'warn', message: 'JWT_SECRET not set — code workspace proxy disabled' };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // 2. LLM availability
  const mode = process.env.GIGACLAW_MODE || 'hybrid';
  const provider = process.env.LLM_PROVIDER || 'anthropic';

  if (mode === 'hybrid' || mode === 'cloud') {
    const cloudCheck = checkCloudProviderConfig(provider);
    if (cloudCheck.available) {
      checks.cloud_llm = { status: 'ok', message: `${provider} API key configured` };
    } else {
      checks.cloud_llm = { status: 'fail', message: cloudCheck.error || `${provider} API key missing` };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  }

  if (mode === 'hybrid' || mode === 'local') {
    try {
      const ollamaCheck = await checkOllamaHealth();
      if (ollamaCheck.available) {
        checks.local_llm = {
          status: 'ok',
          message: `Ollama running — ${ollamaCheck.models?.length || 0} model(s)`,
        };
      } else {
        checks.local_llm = {
          status: mode === 'local' ? 'fail' : 'warn',
          message: ollamaCheck.error || 'Ollama not reachable',
        };
        if (mode === 'local' && overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (err) {
      checks.local_llm = { status: 'warn', message: err.message };
    }
  }

  // 3. Database
  try {
    const { getDb } = await import('../db/index.js');
    const db = getDb();
    if (db) {
      checks.database = { status: 'ok', message: 'SQLite database initialized' };
    } else {
      checks.database = { status: 'fail', message: 'Database not initialized' };
      overallStatus = 'unhealthy';
    }
  } catch (err) {
    checks.database = { status: 'fail', message: err.message };
    overallStatus = 'unhealthy';
  }

  // 4. Server readiness
  checks.server = { status: 'ok', message: 'Server running' };

  // 5. Cron status
  const cronEnabled = process.env.ENABLE_CRON === 'true';
  checks.cron = {
    status: cronEnabled ? 'ok' : 'warn',
    message: cronEnabled ? 'Cron scheduler active' : 'Cron disabled (ENABLE_CRON=false)',
  };

  // 6. Mode summary
  checks.mode = { status: 'ok', message: `GIGACLAW_MODE=${mode}` };

  // Version
  let version = 'unknown';
  try {
    version = process.env.GIGACLAW_VERSION || 'unknown';
  } catch (_) {}

  return {
    status: overallStatus,
    version,
    mode,
    timestamp: new Date().toISOString(),
    checks,
  };
}
