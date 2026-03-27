import { ChatAnthropic } from '@langchain/anthropic';

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.5-pro',
  pragatigpt: 'pragatigpt-1',
  ollama: 'llama3.2',
  custom: 'gpt-4o',
};

/**
 * Create a LangChain chat model based on environment configuration.
 *
 * Supported providers (set via LLM_PROVIDER env var):
 *   anthropic    — Claude models via Anthropic API (default)
 *   openai       — GPT models via OpenAI API
 *   google       — Gemini models via Google AI Studio
 *   pragatigpt   — PragatiGPT via Gignaati edge API (India-first, on-premise)
 *   ollama       — Any model running locally via Ollama (zero cloud dependency)
 *   custom       — Any OpenAI-compatible API endpoint
 *
 * Config env vars:
 *   LLM_PROVIDER          — Provider name (see above)
 *   LLM_MODEL             — Model name override
 *   LLM_MAX_TOKENS        — Max tokens (default: 4096)
 *   ANTHROPIC_API_KEY     — Required for anthropic
 *   OPENAI_API_KEY        — Required for openai
 *   OPENAI_BASE_URL       — Custom base URL for openai/custom
 *   GOOGLE_API_KEY        — Required for google
 *   PRAGATIGPT_API_KEY    — Required for pragatigpt
 *   PRAGATIGPT_BASE_URL   — PragatiGPT endpoint (default: https://api.pragatigpt.in/v1)
 *   OLLAMA_BASE_URL       — Ollama server URL (default: http://localhost:11434)
 *   CUSTOM_API_KEY        — API key for custom endpoints
 *
 * @param {object} [options]
 * @param {number} [options.maxTokens=4096] - Max tokens for the response
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel}
 */
export async function createModel(options = {}) {
  const provider = options.providerOverride || process.env.LLM_PROVIDER || 'anthropic';
  const modelName = options.modelOverride || process.env.LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic;
  const maxTokens = options.maxTokens || Number(process.env.LLM_MAX_TOKENS) || 4096;

  switch (provider) {
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is required.\n' +
          'Get your key at: https://platform.claude.com/settings/keys\n' +
          'Then run: npx gigaclaw set-agent-secret ANTHROPIC_API_KEY'
        );
      }
      return new ChatAnthropic({ modelName, maxTokens, anthropicApiKey: apiKey });
    }

    case 'openai': {
      const { ChatOpenAI } = await import('@langchain/openai');
      const apiKey = process.env.OPENAI_API_KEY;
      const baseURL = process.env.OPENAI_BASE_URL;
      if (!apiKey) {
        throw new Error(
          'OPENAI_API_KEY is required.\n' +
          'Get your key at: https://platform.openai.com/settings/organization/api-keys\n' +
          'Then run: npx gigaclaw set-agent-secret OPENAI_API_KEY'
        );
      }
      const config = { modelName, maxTokens, apiKey };
      if (baseURL) config.configuration = { baseURL };
      return new ChatOpenAI(config);
    }

    case 'google': {
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error(
          'GOOGLE_API_KEY is required.\n' +
          'Get your key at: https://aistudio.google.com/apikey\n' +
          'Then run: npx gigaclaw set-agent-secret GOOGLE_API_KEY'
        );
      }
      return new ChatGoogleGenerativeAI({ model: modelName, maxOutputTokens: maxTokens, apiKey });
    }

    // PragatiGPT — India-first, edge-native AI
    case 'pragatigpt': {
      const { ChatOpenAI } = await import('@langchain/openai');
      const apiKey = process.env.PRAGATIGPT_API_KEY;
      const baseURL = process.env.PRAGATIGPT_BASE_URL || 'https://api.pragatigpt.in/v1';
      if (!apiKey) {
        throw new Error(
          'PRAGATIGPT_API_KEY is required.\n' +
          'Get your key at: https://www.gignaati.com/pragatigpt\n' +
          'Then run: npx gigaclaw set-agent-secret PRAGATIGPT_API_KEY'
        );
      }
      return new ChatOpenAI({
        modelName: modelName || 'pragatigpt-1',
        maxTokens,
        apiKey,
        configuration: { baseURL },
      });
    }

    // Ollama — run any model locally with zero cloud dependency
    case 'ollama': {
      const { ChatOpenAI } = await import('@langchain/openai');
      const baseURL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434') + '/v1';
      return new ChatOpenAI({
        modelName: modelName || 'llama3.2',
        maxTokens,
        apiKey: 'ollama',
        configuration: { baseURL },
      });
    }

    // Custom OpenAI-compatible endpoint (vLLM, LM Studio, Together AI, etc.)
    case 'custom': {
      const { ChatOpenAI } = await import('@langchain/openai');
      const apiKey = process.env.CUSTOM_API_KEY || 'not-needed';
      const baseURL = process.env.OPENAI_BASE_URL;
      if (!baseURL) {
        throw new Error(
          'OPENAI_BASE_URL is required for the custom provider.\n' +
          'Examples:\n' +
          '  http://localhost:11434/v1  (Ollama)\n' +
          '  http://localhost:1234/v1   (LM Studio)\n' +
          '  https://api.together.ai/v1 (Together AI)'
        );
      }
      return new ChatOpenAI({ modelName, maxTokens, apiKey, configuration: { baseURL } });
    }

    default:
      throw new Error(
        `Unknown LLM provider: "${provider}"\n` +
        'Supported: anthropic, openai, google, pragatigpt, ollama, custom\n' +
        'Set LLM_PROVIDER in your .env file.'
      );
  }
}

/**
 * Get a human-readable label for a provider.
 * @param {string} provider
 * @returns {string}
 */
export function getProviderLabel(provider) {
  const labels = {
    anthropic: 'Claude (Anthropic)',
    openai: 'GPT (OpenAI)',
    google: 'Gemini (Google)',
    pragatigpt: 'PragatiGPT (Gignaati — India-first)',
    ollama: 'Ollama (Local — Zero Cloud)',
    custom: 'Custom OpenAI-Compatible API',
  };
  return labels[provider] || provider;
}

/**
 * Validate that required env vars are set for a provider.
 * @param {string} provider
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProviderConfig(provider) {
  const checks = {
    anthropic: () => process.env.ANTHROPIC_API_KEY ? null : 'ANTHROPIC_API_KEY is not set',
    openai: () => process.env.OPENAI_API_KEY ? null : 'OPENAI_API_KEY is not set',
    google: () => process.env.GOOGLE_API_KEY ? null : 'GOOGLE_API_KEY is not set',
    pragatigpt: () => process.env.PRAGATIGPT_API_KEY ? null : 'PRAGATIGPT_API_KEY is not set',
    ollama: () => null,
    custom: () => process.env.OPENAI_BASE_URL ? null : 'OPENAI_BASE_URL is not set',
  };
  const check = checks[provider];
  if (!check) return { valid: false, error: `Unknown provider: ${provider}` };
  const error = check();
  return error ? { valid: false, error } : { valid: true };
}
