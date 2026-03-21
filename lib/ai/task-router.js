/**
 * Task Router — decides whether to use cloud or local LLM per-task in hybrid mode.
 *
 * Reads GIGACLAW_MODE and HYBRID_ROUTING from env to determine routing strategy.
 * When mode is not 'hybrid', all tasks use the default provider.
 *
 * Strategies:
 *   auto           — lightweight classifier prompt asks the primary model
 *   cost-optimized — default to local, escalate on complexity
 *   quality-first  — default to cloud, use local for simple/private tasks
 *   privacy-first  — default to local, cloud only on explicit opt-in
 */

import { checkOllamaHealth, checkCloudProviderConfig } from './provider-health.js';

/** Complexity signals detected by keyword analysis (no LLM call needed) */
const COMPLEX_SIGNALS = [
  /\b(refactor|architect|design|implement|build|deploy|migrate)\b/i,
  /\b(analyze|debug|fix|investigate|diagnose)\b/i,
  /\b(write.*code|create.*function|add.*feature|develop)\b/i,
  /\b(review.*pr|pull.?request|merge.*conflict)\b/i,
  /\b(explain.*in.?depth|compare|trade.?off|pros.*cons)\b/i,
  /\b(multi.?step|complex|comprehensive|detailed)\b/i,
];

const SIMPLE_SIGNALS = [
  /\b(hi|hello|hey|thanks|thank you|ok|yes|no|sure)\b/i,
  /\b(what.?is|define|meaning|translate|convert)\b/i,
  /\b(list|name|count|how.?many)\b/i,
  /\b(summarize|tldr|brief|quick)\b/i,
  /\b(draft|outline|template|placeholder)\b/i,
];

const PRIVACY_SIGNALS = [
  /\b(private|confidential|secret|sensitive|internal)\b/i,
  /\b(password|credential|api.?key|token)\b/i,
  /\b(personal|pii|gdpr|hipaa|compliance)\b/i,
];

/**
 * Score a message for complexity (0 = simple, 1 = complex).
 * Lightweight heuristic — no LLM call.
 */
function scoreComplexity(message) {
  if (!message) return 0.5;

  let score = 0.5;

  // Length is a rough proxy for complexity
  if (message.length > 500) score += 0.15;
  if (message.length > 1500) score += 0.15;
  if (message.length < 50) score -= 0.2;

  // Code blocks suggest coding tasks
  const codeBlocks = (message.match(/```/g) || []).length / 2;
  score += codeBlocks * 0.1;

  // Check for complexity signals
  for (const pattern of COMPLEX_SIGNALS) {
    if (pattern.test(message)) { score += 0.1; break; }
  }

  for (const pattern of SIMPLE_SIGNALS) {
    if (pattern.test(message)) { score -= 0.15; break; }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Check if a message contains privacy-sensitive content.
 */
function hasPrivacySignals(message) {
  if (!message) return false;
  return PRIVACY_SIGNALS.some((pattern) => pattern.test(message));
}

/**
 * Route a task to the appropriate provider based on hybrid mode strategy.
 *
 * @param {string} message - The user's message
 * @param {object} [options] - Additional context
 * @param {string} [options.explicitProvider] - User explicitly requested this provider
 * @returns {Promise<{ provider: string, model: string, reason: string }>}
 */
export async function routeTask(message, options = {}) {
  const mode = process.env.GIGACLAW_MODE;
  const strategy = process.env.HYBRID_ROUTING || 'auto';
  const cloudProvider = process.env.LLM_PROVIDER || 'anthropic';
  const cloudModel = process.env.LLM_MODEL || '';
  const localProvider = process.env.LOCAL_LLM_PROVIDER || 'ollama';
  const localModel = process.env.LOCAL_LLM_MODEL || '';

  // Non-hybrid mode — always use default provider
  if (mode !== 'hybrid') {
    return {
      provider: cloudProvider,
      model: cloudModel,
      reason: `non-hybrid mode (${mode || 'default'})`,
    };
  }

  // Explicit provider request from user or caller
  if (options.explicitProvider) {
    return {
      provider: options.explicitProvider,
      model: options.explicitProvider === localProvider ? localModel : cloudModel,
      reason: 'explicit provider request',
    };
  }

  // Check provider availability
  const ollamaHealth = localProvider === 'ollama' ? await checkOllamaHealth() : { available: true };
  const cloudConfig = checkCloudProviderConfig(cloudProvider);

  const localAvailable = ollamaHealth.available && localModel;
  const cloudAvailable = cloudConfig.available;

  // If only one is available, use that
  if (!localAvailable && cloudAvailable) {
    return { provider: cloudProvider, model: cloudModel, reason: 'local provider unavailable' };
  }
  if (localAvailable && !cloudAvailable) {
    return { provider: localProvider, model: localModel, reason: 'cloud provider unavailable' };
  }
  if (!localAvailable && !cloudAvailable) {
    // Fallback: try cloud anyway (it might work with defaults)
    return { provider: cloudProvider, model: cloudModel, reason: 'both providers unavailable — fallback to cloud' };
  }

  // Both available — apply strategy
  const complexity = scoreComplexity(message);
  const isPrivate = hasPrivacySignals(message);

  switch (strategy) {
    case 'auto': {
      // Smart routing: complex → cloud, simple → local, private → local
      if (isPrivate) {
        return { provider: localProvider, model: localModel, reason: 'privacy-sensitive content detected' };
      }
      if (complexity >= 0.6) {
        return { provider: cloudProvider, model: cloudModel, reason: `high complexity (${complexity.toFixed(2)})` };
      }
      return { provider: localProvider, model: localModel, reason: `low complexity (${complexity.toFixed(2)})` };
    }

    case 'cost-optimized': {
      // Default to local, escalate to cloud for complex tasks
      if (complexity >= 0.7) {
        return { provider: cloudProvider, model: cloudModel, reason: `cost-optimized escalation (${complexity.toFixed(2)})` };
      }
      return { provider: localProvider, model: localModel, reason: 'cost-optimized — using local' };
    }

    case 'quality-first': {
      // Default to cloud, use local only for simple/private
      if (isPrivate) {
        return { provider: localProvider, model: localModel, reason: 'privacy-sensitive — routed to local' };
      }
      if (complexity < 0.3) {
        return { provider: localProvider, model: localModel, reason: `simple task — routed to local (${complexity.toFixed(2)})` };
      }
      return { provider: cloudProvider, model: cloudModel, reason: 'quality-first — using cloud' };
    }

    case 'privacy-first': {
      // Default to local, cloud only when truly needed
      if (complexity >= 0.8) {
        return { provider: cloudProvider, model: cloudModel, reason: `very high complexity — cloud required (${complexity.toFixed(2)})` };
      }
      return { provider: localProvider, model: localModel, reason: 'privacy-first — using local' };
    }

    default:
      return { provider: cloudProvider, model: cloudModel, reason: `unknown strategy: ${strategy}` };
  }
}
