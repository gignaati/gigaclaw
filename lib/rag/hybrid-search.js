/**
 * lib/rag/hybrid-search.js — Hybrid Search (BM25 + Vector Fusion)
 *
 * Combines BM25 keyword search with vector cosine similarity for
 * retrieval that handles both exact keyword matches and semantic similarity.
 *
 * Algorithm:
 *   1. BM25 score: computed from term frequency and inverse document frequency
 *   2. Vector score: cosine similarity from vector-store.js
 *   3. Fusion: Reciprocal Rank Fusion (RRF) — proven to outperform linear
 *      combination without requiring score normalisation
 *
 * RRF formula: score(d) = Σ 1 / (k + rank(d, list_i))
 * where k=60 is the standard constant that prevents high-rank documents
 * from dominating the fusion.
 *
 * Architecture: Runs entirely in-process — no external search engine needed.
 */

import { searchVectors } from './vector-store.js';
import { embedQuery } from './embeddings.js';

const RRF_K = 60;

/**
 * Tokenize text for BM25 — lowercase, split on non-alphanumeric.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1);
}

/**
 * Compute BM25 scores for a query against a corpus of documents.
 *
 * @param {string} query
 * @param {Array<{id: number, text: string}>} docs
 * @param {Object} [params]
 * @param {number} [params.k1=1.5] - Term saturation parameter
 * @param {number} [params.b=0.75] - Length normalisation parameter
 * @returns {Map<number, number>} Map of doc.id → BM25 score
 */
function computeBm25(query, docs, params = {}) {
  const { k1 = 1.5, b = 0.75 } = params;
  const queryTerms = tokenize(query);
  const N = docs.length;

  if (N === 0 || queryTerms.length === 0) return new Map();

  // Build term frequency maps and document lengths
  const docTermFreqs = docs.map(doc => {
    const terms = tokenize(doc.text);
    const freq = new Map();
    for (const term of terms) {
      freq.set(term, (freq.get(term) || 0) + 1);
    }
    return { id: doc.id, freq, length: terms.length };
  });

  // Average document length
  const avgDocLen = docTermFreqs.reduce((sum, d) => sum + d.length, 0) / N;

  // Build IDF: log((N - df + 0.5) / (df + 0.5) + 1)
  const idf = new Map();
  for (const term of queryTerms) {
    const df = docTermFreqs.filter(d => d.freq.has(term)).length;
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  // Compute BM25 score for each document
  const scores = new Map();
  for (const doc of docTermFreqs) {
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.freq.get(term) || 0;
      if (tf === 0) continue;
      const termIdf = idf.get(term) || 0;
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (doc.length / avgDocLen));
      score += termIdf * (numerator / denominator);
    }
    scores.set(doc.id, score);
  }

  return scores;
}

/**
 * Apply Reciprocal Rank Fusion to merge two ranked lists.
 *
 * @param {Array<{id: number, score: number}>} list1 - First ranked list
 * @param {Array<{id: number, score: number}>} list2 - Second ranked list
 * @param {number} [k=60] - RRF constant
 * @returns {Map<number, number>} Map of id → RRF score
 */
function reciprocalRankFusion(list1, list2, k = RRF_K) {
  const rrfScores = new Map();

  const addRankScores = (list) => {
    const sorted = [...list].sort((a, b) => b.score - a.score);
    sorted.forEach((item, rank) => {
      const current = rrfScores.get(item.id) || 0;
      rrfScores.set(item.id, current + 1 / (k + rank + 1));
    });
  };

  addRankScores(list1);
  addRankScores(list2);

  return rrfScores;
}

/**
 * Perform hybrid search combining BM25 and vector similarity.
 *
 * @param {string} query - Natural language query
 * @param {Object} [options]
 * @param {number} [options.k=5] - Number of results to return
 * @param {number} [options.vectorK=20] - Candidates from vector search
 * @param {number} [options.bm25K=20] - Candidates from BM25 search
 * @param {number} [options.minScore=0.0] - Minimum vector similarity threshold
 * @param {string[]} [options.sources] - Filter to specific sources
 * @param {'local' | 'cloud'} [options.embeddingProvider] - Override embedding provider
 * @returns {Promise<Array<{id: number, source: string, chunkIndex: number, text: string, score: number, tokenCount: number}>>}
 */
export async function hybridSearch(query, options = {}) {
  const {
    k = 5,
    vectorK = 20,
    bm25K = 20,
    minScore = 0.0,
    sources,
    embeddingProvider,
  } = options;

  // Step 1: Vector search — get top vectorK candidates
  const queryVector = await embedQuery(query, { provider: embeddingProvider });
  const vectorResults = searchVectors(queryVector, {
    k: vectorK,
    minScore,
    sources,
  });

  if (vectorResults.length === 0) return [];

  // Step 2: BM25 search over the vector candidates
  // (BM25 over the full corpus would be expensive without an index;
  //  running it over vector candidates is a good approximation)
  const bm25Scores = computeBm25(
    query,
    vectorResults.map(r => ({ id: r.id, text: r.text })),
  );

  // Convert to ranked lists
  const vectorList = vectorResults.map(r => ({ id: r.id, score: r.score }));
  const bm25List = Array.from(bm25Scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, bm25K);

  // Step 3: RRF fusion
  const rrfScores = reciprocalRankFusion(vectorList, bm25List);

  // Step 4: Re-rank by RRF score and return top-k with full chunk data
  const resultMap = new Map(vectorResults.map(r => [r.id, r]));
  const ranked = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id, rrfScore]) => {
      const chunk = resultMap.get(id);
      return { ...chunk, score: rrfScore };
    })
    .filter(Boolean);

  return ranked;
}

/**
 * Simple vector-only search (no BM25).
 * Use when query is purely semantic and keyword matching is not needed.
 *
 * @param {string} query
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
export async function vectorSearch(query, options = {}) {
  const { k = 5, minScore = 0.0, sources, embeddingProvider } = options;
  const queryVector = await embedQuery(query, { provider: embeddingProvider });
  return searchVectors(queryVector, { k, minScore, sources });
}
