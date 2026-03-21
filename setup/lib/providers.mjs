/**
 * Provider registry — single source of truth for GigaClaw LLM providers.
 *
 * GigaClaw supports 6 providers:
 *   anthropic   — Claude (Anthropic)
 *   openai      — GPT (OpenAI)
 *   google      — Gemini (Google)
 *   pragatigpt  — PragatiGPT (Gignaati — India-first, edge-native)
 *   ollama      — Ollama (Local — zero cloud dependency)
 *   custom      — Any OpenAI-compatible API endpoint
 *
 * "builtin" means the agent runner has a built-in provider (no models.json needed).
 */
export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    keyPrefix: 'sk-ant-',
    keyPage: 'https://platform.claude.com/settings/keys',
    builtin: true,
    oauthSupported: true,
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', default: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ],
  },
  openai: {
    label: 'GPT (OpenAI)',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    keyPrefix: 'sk-',
    keyPage: 'https://platform.openai.com/settings/organization/api-keys',
    builtin: false,
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-completions',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2', default: true },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'o4-mini', name: 'o4-mini' },
    ],
  },
  google: {
    label: 'Gemini (Google)',
    name: 'Google',
    envKey: 'GOOGLE_API_KEY',
    keyPage: 'https://aistudio.google.com/apikey',
    builtin: true,
    models: [
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', default: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
  },

  // PragatiGPT — India-first, edge-native AI by Gignaati
  // 100% data privacy, no foreign cloud dependency, optimized for Indian infrastructure
  pragatigpt: {
    label: 'PragatiGPT (Gignaati — India-first)',
    name: 'PragatiGPT',
    envKey: 'PRAGATIGPT_API_KEY',
    keyPage: 'https://www.gignaati.com/pragatigpt',
    builtin: false,
    baseUrl: 'https://api.pragatigpt.in/v1',
    api: 'openai-completions',
    oauthSupported: false,
    models: [
      { id: 'pragatigpt-1', name: 'PragatiGPT-1 (General)', default: true },
      { id: 'pragatigpt-1-mini', name: 'PragatiGPT-1 Mini (Fast)' },
      { id: 'pragatigpt-1-edge', name: 'PragatiGPT-1 Edge (On-device)' },
    ],
  },

  // Ollama — run any open-source model locally with zero cloud dependency
  ollama: {
    label: 'Ollama (Local — Zero Cloud)',
    name: 'Ollama',
    envKey: null,
    keyPage: 'https://ollama.com',
    builtin: false,
    baseUrl: 'http://localhost:11434/v1',
    api: 'openai-completions',
    oauthSupported: false,
    models: [
      { id: 'llama3.2', name: 'Llama 3.2 (3B)', default: true },
      { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)' },
      { id: 'mistral', name: 'Mistral 7B' },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 (7B)' },
      { id: 'phi4', name: 'Phi-4 (14B)' },
    ],
  },

  // Custom — any OpenAI-compatible API endpoint (vLLM, LM Studio, Together AI, etc.)
  custom: {
    label: 'Custom OpenAI-Compatible API',
    name: 'Custom',
    envKey: 'CUSTOM_API_KEY',
    keyPage: null,
    builtin: false,
    baseUrl: null,
    api: 'openai-completions',
    oauthSupported: false,
    models: [],
  },
};
