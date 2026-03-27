/**
 * lib/rag/embeddings.js — Embedding Provider
 *
 * Generates vector embeddings for RAG chunks.
 * Supports two providers:
 *   local  — Ollama (nomic-embed-text, 768 dims, runs 100% on-device)
 *   cloud  — OpenAI text-embedding-3-small (1536 dims, requires API key)
 *
 * Provider selection:
 *   RAG_EMBEDDING_PROVIDER=local  (default — uses Ollama)
 *   RAG_EMBEDDING_PROVIDER=cloud  (uses OpenAI)
 *
 * Model selection:
 *   RAG_EMBEDDING_MODEL=nomic-embed-text  (default for local)
 *   RAG_EMBEDDING_MODEL=text-embedding-3-small  (default for cloud)
 *
 * Architecture: Edge-first — defaults to local Ollama, cloud is opt-in.
 */

const DEFAULT_LOCAL_MODEL = 'nomic-embed-text';
const DEFAULT_CLOUD_MODEL = 'text-embedding-3-small';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

/**
 * Get the configured embedding provider.
 * @returns {'local' | 'cloud'}
 */
export function getEmbeddingProvider() {
  const provider = (process.env.RAG_EMBEDDING_PROVIDER || 'local').toLowerCase();
  return provider === 'cloud' ? 'cloud' : 'local';
}

/**
 * Get the configured embedding model.
 * @returns {string}
 */
export function getEmbeddingModel() {
  const provider = getEmbeddingProvider();
  const defaultModel = provider === 'cloud' ? DEFAULT_CLOUD_MODEL : DEFAULT_LOCAL_MODEL;
  return process.env.RAG_EMBEDDING_MODEL || defaultModel;
}

/**
 * Generate embeddings for a batch of texts using Ollama (local).
 * @param {string[]} texts
 * @param {string} model
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function embedWithOllama(texts, model) {
  const embeddings = [];

  for (const text of texts) {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embedding failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error(`Ollama returned unexpected embedding format: ${JSON.stringify(data)}`);
    }
    embeddings.push(data.embedding);
  }

  return embeddings;
}

/**
 * Generate embeddings for a batch of texts using OpenAI.
 * @param {string[]} texts
 * @param {string} model
 * @returns {Promise<number[][]>}
 */
async function embedWithOpenAI(texts, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for cloud embedding provider');
  }

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embedding failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  // Sort by index to ensure order matches input
  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map(item => item.embedding);
}

/**
 * Generate embeddings for an array of text strings.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @param {Object} [options]
 * @param {'local' | 'cloud'} [options.provider] - Override provider
 * @param {string} [options.model] - Override model
 * @param {number} [options.batchSize=32] - Batch size for cloud providers
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, options = {}) {
  const provider = options.provider || getEmbeddingProvider();
  const model = options.model || getEmbeddingModel();
  const batchSize = options.batchSize || 32;

  if (!texts || texts.length === 0) return [];

  if (provider === 'cloud') {
    // Cloud: batch requests to stay within rate limits
    const allEmbeddings = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await embedWithOpenAI(batch, model);
      allEmbeddings.push(...batchEmbeddings);
    }
    return allEmbeddings;
  }

  // Local: Ollama processes one at a time (no batching API)
  return embedWithOllama(texts, model);
}

/**
 * Generate a single embedding vector for a query string.
 * Used at query time for similarity search.
 *
 * @param {string} query
 * @param {Object} [options]
 * @returns {Promise<number[]>} Single embedding vector
 */
export async function embedQuery(query, options = {}) {
  const embeddings = await generateEmbeddings([query], options);
  return embeddings[0];
}

/**
 * Check if the Ollama embedding model is available.
 * @param {string} [model]
 * @returns {Promise<boolean>}
 */
export async function isEmbeddingModelAvailable(model) {
  const targetModel = model || getEmbeddingModel();
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    const models = (data.models || []).map(m => m.name.split(':')[0]);
    return models.includes(targetModel.split(':')[0]);
  } catch {
    return false;
  }
}

/**
 * Get the embedding dimension for the current model.
 * Returns null if the model is not available.
 * @returns {Promise<number | null>}
 */
export async function getEmbeddingDimension() {
  const provider = getEmbeddingProvider();
  const model = getEmbeddingModel();

  // Known dimensions for common models
  const KNOWN_DIMS = {
    'nomic-embed-text': 768,
    'mxbai-embed-large': 1024,
    'all-minilm': 384,
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
    'text-embedding-ada-002': 1536,
  };

  const modelBase = model.split(':')[0];
  if (KNOWN_DIMS[modelBase]) return KNOWN_DIMS[modelBase];

  // For unknown models, probe with a test embedding
  try {
    const testEmbedding = await generateEmbeddings(['test'], { provider, model });
    return testEmbedding[0]?.length || null;
  } catch {
    return null;
  }
}
