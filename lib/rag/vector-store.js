/**
 * lib/rag/vector-store.js — SQLite Vector Store
 *
 * Stores and retrieves document chunks with their embeddings using
 * SQLite (via better-sqlite3, already a project dependency).
 *
 * This is the local-first vector store — no external vector DB required.
 * For production scale (>1M chunks), the architecture supports swapping
 * to Qdrant or ChromaDB by implementing the same interface.
 *
 * Storage: {PROJECT_ROOT}/.gigaclaw/rag/vectors.db
 *
 * Interface:
 *   insert(chunks)           — store chunks with embeddings
 *   search(queryVector, k)   — cosine similarity top-k search
 *   delete(source)           — remove all chunks for a source file
 *   stats()                  — return chunk count and source list
 *   clear()                  — wipe all vectors (use with caution)
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const DB_DIR = path.join(PROJECT_ROOT, '.gigaclaw', 'rag');
const DB_PATH = path.join(DB_DIR, 'vectors.db');

let _db = null;

/**
 * Get or create the SQLite database connection.
 * @returns {Database.Database}
 */
function getDb() {
  if (_db) return _db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');

  // Create the chunks table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT    NOT NULL,
      chunk_index INTEGER NOT NULL,
      text        TEXT    NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      embedding   BLOB    NOT NULL,
      metadata    TEXT    NOT NULL DEFAULT '{}',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_rag_chunks_source
      ON rag_chunks(source);

    CREATE INDEX IF NOT EXISTS idx_rag_chunks_created
      ON rag_chunks(created_at);
  `);

  return _db;
}

/**
 * Serialize a float32 embedding vector to a Buffer.
 * @param {number[]} vector
 * @returns {Buffer}
 */
function serializeVector(vector) {
  const buf = Buffer.allocUnsafe(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buf.writeFloatLE(vector[i], i * 4);
  }
  return buf;
}

/**
 * Deserialize a Buffer back to a float32 embedding vector.
 * @param {Buffer} buf
 * @returns {number[]}
 */
function deserializeVector(buf) {
  const len = buf.length / 4;
  const vector = new Array(len);
  for (let i = 0; i < len; i++) {
    vector[i] = buf.readFloatLE(i * 4);
  }
  return vector;
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity score in [-1, 1]
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Insert chunks with their embeddings into the vector store.
 *
 * @param {Array<{text: string, index: number, source: string, tokenCount: number, embedding: number[]}>} chunks
 * @returns {number} Number of chunks inserted
 */
export function insertChunks(chunks) {
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO rag_chunks (source, chunk_index, text, token_count, embedding, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const chunk of items) {
      insert.run(
        chunk.source,
        chunk.index,
        chunk.text,
        chunk.tokenCount || 0,
        serializeVector(chunk.embedding),
        JSON.stringify(chunk.metadata || {}),
      );
    }
  });

  insertMany(chunks);
  return chunks.length;
}

/**
 * Search for the top-k most similar chunks to a query vector.
 *
 * @param {number[]} queryVector - Query embedding vector
 * @param {Object} [options]
 * @param {number} [options.k=5] - Number of results to return
 * @param {number} [options.minScore=0.0] - Minimum similarity threshold
 * @param {string[]} [options.sources] - Filter to specific sources
 * @returns {Array<{id: number, source: string, chunkIndex: number, text: string, score: number, tokenCount: number}>}
 */
export function searchVectors(queryVector, options = {}) {
  const db = getDb();
  const { k = 5, minScore = 0.0, sources } = options;

  let query = 'SELECT id, source, chunk_index, text, token_count, embedding FROM rag_chunks';
  const params = [];

  if (sources && sources.length > 0) {
    query += ` WHERE source IN (${sources.map(() => '?').join(',')})`;
    params.push(...sources);
  }

  const rows = db.prepare(query).all(...params);

  // Compute cosine similarity for all rows
  const scored = rows.map(row => ({
    id: row.id,
    source: row.source,
    chunkIndex: row.chunk_index,
    text: row.text,
    tokenCount: row.token_count,
    score: cosineSimilarity(queryVector, deserializeVector(row.embedding)),
  }));

  // Sort by score descending, filter by minScore, return top-k
  return scored
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Delete all chunks for a given source file.
 * @param {string} source - Source file path or identifier
 * @returns {number} Number of rows deleted
 */
export function deleteSource(source) {
  const db = getDb();
  const result = db.prepare('DELETE FROM rag_chunks WHERE source = ?').run(source);
  return result.changes;
}

/**
 * Get vector store statistics.
 * @returns {{totalChunks: number, sources: string[], dbPath: string}}
 */
export function getVectorStoreStats() {
  const db = getDb();
  const totalChunks = db.prepare('SELECT COUNT(*) as count FROM rag_chunks').get().count;
  const sources = db.prepare('SELECT DISTINCT source FROM rag_chunks ORDER BY source').all().map(r => r.source);
  return { totalChunks, sources, dbPath: DB_PATH };
}

/**
 * Check if a source has already been indexed.
 * @param {string} source
 * @returns {boolean}
 */
export function isSourceIndexed(source) {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM rag_chunks WHERE source = ? LIMIT 1').get(source);
  return !!row;
}

/**
 * Clear all vectors from the store. Use with caution.
 * @returns {number} Number of rows deleted
 */
export function clearVectorStore() {
  const db = getDb();
  const result = db.prepare('DELETE FROM rag_chunks').run();
  return result.changes;
}

/**
 * Close the database connection. Call on process exit.
 */
export function closeVectorStore() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
