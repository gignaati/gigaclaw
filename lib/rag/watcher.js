/**
 * lib/rag/watcher.js — File System Watcher
 *
 * Watches the user's knowledge base directory for file changes and
 * automatically re-ingests modified or new files into the RAG vector store.
 *
 * Default watch directory: ~/gigaclaw-docs/
 * Override: RAG_DOCS_DIR environment variable
 *
 * Behaviour:
 *   - On startup: ingests all supported files not yet in the vector store
 *   - On file add/change: re-ingests the file (deletes old chunks first)
 *   - On file delete: removes all chunks for that file from the vector store
 *   - Debounce: 2s delay to avoid re-ingesting during rapid saves
 *
 * Uses Node.js native fs.watch — no external dependency required.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { isSupportedFile, extractFile } from './extractors.js';
import { chunkDocument } from './chunker.js';
import { generateEmbeddings } from './embeddings.js';
import { insertChunks, deleteSource, isSourceIndexed } from './vector-store.js';

const DEFAULT_DOCS_DIR = path.join(os.homedir(), 'gigaclaw-docs');
const DEBOUNCE_MS = 2000;

let _watcher = null;
const _debounceTimers = new Map();

/**
 * Get the configured docs directory.
 * @returns {string}
 */
export function getDocsDir() {
  return process.env.RAG_DOCS_DIR || DEFAULT_DOCS_DIR;
}

/**
 * Ingest a single file into the vector store.
 * Deletes existing chunks for the file before re-ingesting.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<{source: string, chunks: number, skipped: boolean, error?: string}>}
 */
export async function ingestFile(filePath) {
  const source = filePath;

  try {
    // Extract text
    const { text, metadata } = await extractFile(filePath);
    if (!text || text.trim().length === 0) {
      return { source, chunks: 0, skipped: true };
    }

    // Chunk the document
    const chunks = chunkDocument(text, { source });
    if (chunks.length === 0) {
      return { source, chunks: 0, skipped: true };
    }

    // Generate embeddings
    const texts = chunks.map(c => c.text);
    const embeddings = await generateEmbeddings(texts);

    // Attach embeddings to chunks
    const chunksWithEmbeddings = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
      metadata: { ...metadata, filePath },
    }));

    // Delete old chunks and insert new ones
    deleteSource(source);
    const inserted = insertChunks(chunksWithEmbeddings);

    console.log(`[RAG] Ingested ${path.basename(filePath)} → ${inserted} chunks`);
    return { source, chunks: inserted, skipped: false };
  } catch (err) {
    console.error(`[RAG] Failed to ingest ${path.basename(filePath)}: ${err.message}`);
    return { source, chunks: 0, skipped: false, error: err.message };
  }
}

/**
 * Ingest all supported files in a directory (recursive).
 *
 * @param {string} dirPath - Directory to scan
 * @param {Object} [options]
 * @param {boolean} [options.skipIndexed=true] - Skip files already in the vector store
 * @returns {Promise<{ingested: number, skipped: number, errors: number}>}
 */
export async function ingestDirectory(dirPath, options = {}) {
  const { skipIndexed = true } = options;
  const stats = { ingested: 0, skipped: 0, errors: 0 };

  if (!fs.existsSync(dirPath)) {
    console.log(`[RAG] Docs directory not found: ${dirPath} — creating it`);
    fs.mkdirSync(dirPath, { recursive: true });
    return stats;
  }

  const files = walkDirectory(dirPath);

  for (const filePath of files) {
    if (!isSupportedFile(filePath)) {
      stats.skipped++;
      continue;
    }

    if (skipIndexed && isSourceIndexed(filePath)) {
      stats.skipped++;
      continue;
    }

    const result = await ingestFile(filePath);
    if (result.error) {
      stats.errors++;
    } else if (result.skipped) {
      stats.skipped++;
    } else {
      stats.ingested++;
    }
  }

  return stats;
}

/**
 * Recursively walk a directory and return all file paths.
 * @param {string} dirPath
 * @returns {string[]}
 */
function walkDirectory(dirPath) {
  const files = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          files.push(...walkDirectory(fullPath));
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return files;
}

/**
 * Handle a file change event with debouncing.
 * @param {string} eventType - 'change' or 'rename'
 * @param {string} filePath - Absolute path to the changed file
 */
function handleFileChange(eventType, filePath) {
  // Clear existing debounce timer for this file
  if (_debounceTimers.has(filePath)) {
    clearTimeout(_debounceTimers.get(filePath));
  }

  const timer = setTimeout(async () => {
    _debounceTimers.delete(filePath);

    if (!fs.existsSync(filePath)) {
      // File was deleted
      const deleted = deleteSource(filePath);
      if (deleted > 0) {
        console.log(`[RAG] Removed ${deleted} chunks for deleted file: ${path.basename(filePath)}`);
      }
      return;
    }

    if (!isSupportedFile(filePath)) return;

    await ingestFile(filePath);
  }, DEBOUNCE_MS);

  _debounceTimers.set(filePath, timer);
}

/**
 * Start watching the docs directory for changes.
 *
 * @param {string} [docsDir] - Directory to watch (defaults to RAG_DOCS_DIR or ~/gigaclaw-docs/)
 * @returns {Promise<{watching: boolean, docsDir: string, initialIngest: Object}>}
 */
export async function startWatcher(docsDir) {
  const watchDir = docsDir || getDocsDir();

  // Ensure the directory exists
  if (!fs.existsSync(watchDir)) {
    fs.mkdirSync(watchDir, { recursive: true });
    console.log(`[RAG] Created docs directory: ${watchDir}`);
  }

  // Initial ingest of all existing files
  console.log(`[RAG] Starting initial ingest from: ${watchDir}`);
  const initialIngest = await ingestDirectory(watchDir, { skipIndexed: true });
  console.log(`[RAG] Initial ingest complete — ${initialIngest.ingested} files ingested, ${initialIngest.skipped} skipped`);

  // Start watching
  _watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const filePath = path.join(watchDir, filename);
    handleFileChange(eventType, filePath);
  });

  _watcher.on('error', (err) => {
    console.error(`[RAG] Watcher error: ${err.message}`);
  });

  console.log(`[RAG] Watching for changes in: ${watchDir}`);

  return { watching: true, docsDir: watchDir, initialIngest };
}

/**
 * Stop the file system watcher.
 */
export function stopWatcher() {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
  // Clear all pending debounce timers
  for (const timer of _debounceTimers.values()) {
    clearTimeout(timer);
  }
  _debounceTimers.clear();
  console.log('[RAG] Watcher stopped');
}
