/**
 * Provider health checking for hybrid mode.
 * Detects whether local (Ollama) and cloud providers are available at runtime.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/** Cache health check results for a short TTL to avoid hammering endpoints */
const _cache = new Map();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Check if Ollama is running and reachable.
 * @returns {Promise<{ available: boolean, models?: string[], error?: string }>}
 */
export async function checkOllamaHealth() {
  const cached = _cache.get('ollama');
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const result = { available: false, error: `Ollama returned ${res.status}` };
      _cache.set('ollama', { ts: Date.now(), result });
      return result;
    }
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    const result = { available: true, models };
    _cache.set('ollama', { ts: Date.now(), result });
    return result;
  } catch (err) {
    const result = { available: false, error: err.message };
    _cache.set('ollama', { ts: Date.now(), result });
    return result;
  }
}

/**
 * Check if a cloud provider's API key is configured.
 * Does NOT make a network call — just checks env vars.
 * @param {string} provider - Provider name (anthropic, openai, google, pragatigpt, custom)
 * @returns {{ available: boolean, error?: string }}
 */
export function checkCloudProviderConfig(provider) {
  const keyMap = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    pragatigpt: 'PRAGATIGPT_API_KEY',
    custom: 'CUSTOM_API_KEY',
  };

  if (provider === 'ollama') {
    return { available: true }; // Ollama doesn't need an API key
  }

  const envKey = keyMap[provider];
  if (!envKey) return { available: false, error: `Unknown provider: ${provider}` };

  return process.env[envKey]
    ? { available: true }
    : { available: false, error: `${envKey} is not set` };
}

/**
 * Get the availability status of all configured providers.
 * @returns {Promise<Record<string, { available: boolean, type: 'local'|'cloud', error?: string }>>}
 */
export async function getAllProviderStatus() {
  const LOCAL_PROVIDERS = new Set(['ollama', 'pragatigpt']);
  const providers = ['anthropic', 'openai', 'google', 'pragatigpt', 'ollama', 'custom'];
  const status = {};

  for (const p of providers) {
    const type = LOCAL_PROVIDERS.has(p) ? 'local' : 'cloud';
    if (p === 'ollama') {
      const health = await checkOllamaHealth();
      status[p] = { ...health, type };
    } else {
      const config = checkCloudProviderConfig(p);
      status[p] = { ...config, type };
    }
  }

  return status;
}

/**
 * Clear the health check cache (e.g., after config changes).
 */
export function clearHealthCache() {
  _cache.clear();
}
