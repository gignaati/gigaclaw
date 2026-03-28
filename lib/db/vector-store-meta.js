/**
 * vector-store-meta.js — compatibility shim
 *
 * Re-exports vector store statistics helpers from the RAG layer.
 * This module exists so that knowledge-base-actions.js can import
 * `getVectorStoreStats` and `listSources` from a stable, versioned path.
 */
import { getVectorStoreStats as _getStats } from '../rag/vector-store.js';

export { getVectorStoreStats } from '../rag/vector-store.js';

/**
 * listSources — return a deduplicated list of source file paths
 * that have at least one chunk in the vector store.
 *
 * @returns {string[]}
 */
export function listSources() {
  const stats = _getStats();
  return stats?.sources || [];
}
