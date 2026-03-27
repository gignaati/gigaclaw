/**
 * lib/rag/index.js — RAG Orchestrator
 *
 * Public API for the Local RAG Engine.
 * Coordinates chunking, embedding, storage, and retrieval.
 *
 * Usage:
 *   import { ingest, search, deleteKnowledge, getStats } from '../lib/rag/index.js';
 *
 *   // Ingest a file or directory
 *   await ingest('/path/to/document.pdf');
 *   await ingest('/path/to/docs/');
 *
 *   // Search with a natural language query
 *   const results = await search('How does the authentication flow work?');
 *
 *   // Delete knowledge for a source
 *   await deleteKnowledge('/path/to/document.pdf');
 *
 *   // Get stats
 *   const stats = getStats();
 */

import fs from 'fs';
import { extractFile } from './extractors.js';
import { chunkDocument } from './chunker.js';
import { generateEmbeddings } from './embeddings.js';
import { insertChunks, deleteSource, getVectorStoreStats } from './vector-store.js';
import { hybridSearch, vectorSearch } from './hybrid-search.js';
import { ingestFile, ingestDirectory, startWatcher, stopWatcher, getDocsDir } from './watcher.js';

export { startWatcher, stopWatcher, getDocsDir };

/**
 * Ingest a file or directory into the RAG knowledge base.
 *
 * @param {string} sourcePath - Path to a file or directory
 * @param {Object} [options]
 * @param {boolean} [options.skipIndexed=false] - Skip files already indexed
 * @param {number} [options.maxTokens=512] - Max tokens per chunk
 * @param {number} [options.overlapTokens=64] - Overlap tokens between chunks
 * @returns {Promise<{ingested: number, skipped: number, errors: number} | {source: string, chunks: number}>}
 */
export async function ingest(sourcePath, options = {}) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Path does not exist: ${sourcePath}`);
  }

  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    return ingestDirectory(sourcePath, options);
  }

  return ingestFile(sourcePath);
}

/**
 * Search the knowledge base with a natural language query.
 *
 * @param {string} query - Natural language query
 * @param {Object} [options]
 * @param {number} [options.k=5] - Number of results
 * @param {'hybrid' | 'vector'} [options.mode='hybrid'] - Search mode
 * @param {number} [options.minScore=0.0] - Minimum similarity score
 * @param {string[]} [options.sources] - Filter to specific sources
 * @returns {Promise<Array<{id: number, source: string, text: string, score: number, chunkIndex: number, tokenCount: number}>>}
 */
export async function search(query, options = {}) {
  const { mode = 'hybrid', ...rest } = options;

  if (mode === 'vector') {
    return vectorSearch(query, rest);
  }

  return hybridSearch(query, rest);
}

/**
 * Delete all knowledge chunks for a given source.
 *
 * @param {string} source - Source file path or identifier
 * @returns {number} Number of chunks deleted
 */
export function deleteKnowledge(source) {
  return deleteSource(source);
}

/**
 * Get statistics about the knowledge base.
 * @returns {{totalChunks: number, sources: string[], dbPath: string}}
 */
export function getStats() {
  return getVectorStoreStats();
}

/**
 * Build a RAG context string from search results for injection into LLM prompts.
 * Formats results as a numbered list of excerpts with source attribution.
 *
 * @param {Array<{text: string, source: string, score: number}>} results
 * @param {Object} [options]
 * @param {number} [options.maxContextTokens=2048] - Max total tokens in context
 * @param {boolean} [options.includeScores=false] - Include similarity scores
 * @returns {string} Formatted context string
 */
export function buildRagContext(results, options = {}) {
  const { maxContextTokens = 2048, includeScores = false } = options;
  const CHARS_PER_TOKEN = 4;
  const maxChars = maxContextTokens * CHARS_PER_TOKEN;

  let context = '';
  let totalChars = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const sourceName = result.source.split('/').pop() || result.source;
    const scoreStr = includeScores ? ` (score: ${result.score.toFixed(3)})` : '';
    const excerpt = `[${i + 1}] From: ${sourceName}${scoreStr}\n${result.text}\n\n`;

    if (totalChars + excerpt.length > maxChars) break;

    context += excerpt;
    totalChars += excerpt.length;
  }

  return context.trim();
}

/**
 * Perform a RAG-augmented query: search + build context string.
 * Designed for direct injection into LLM system prompts.
 *
 * @param {string} query
 * @param {Object} [options]
 * @returns {Promise<{context: string, sources: string[], resultCount: number}>}
 */
export async function ragQuery(query, options = {}) {
  const results = await search(query, options);

  if (results.length === 0) {
    return { context: '', sources: [], resultCount: 0 };
  }

  const context = buildRagContext(results, options);
  const sources = [...new Set(results.map(r => r.source))];

  return { context, sources, resultCount: results.length };
}
