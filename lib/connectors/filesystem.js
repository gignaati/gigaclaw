/**
 * lib/connectors/filesystem.js — Local File System Connector
 *
 * Connects to a local directory and ingests all supported documents
 * into the RAG knowledge base.
 *
 * This is the default connector — it watches ~/gigaclaw-docs/ by default
 * and can be configured to watch any local directory.
 *
 * Configuration:
 *   path  — Absolute path to the directory to watch (required)
 *   watch — Whether to watch for file changes (default: true)
 *   recursive — Whether to recurse into subdirectories (default: true)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { BaseConnector } from './base.js';
import { isSupportedFile, extractFile, SUPPORTED_EXTENSIONS } from '../rag/extractors.js';
import { isSourceIndexed } from '../rag/vector-store.js';
import { startWatcher, stopWatcher, ingestFile } from '../rag/watcher.js';

const DEFAULT_DOCS_DIR = path.join(os.homedir(), 'gigaclaw-docs');

export class FilesystemConnector extends BaseConnector {
  /**
   * @param {Object} config
   * @param {string} [config.path] - Directory to connect to
   * @param {boolean} [config.watch=true] - Watch for changes
   * @param {boolean} [config.recursive=true] - Recurse into subdirectories
   */
  constructor(config = {}) {
    super({
      id: 'filesystem',
      name: 'Local File System',
      ...config,
    });
    this.docsPath = config.path || process.env.RAG_DOCS_DIR || DEFAULT_DOCS_DIR;
    this.watch = config.watch !== false;
    this.recursive = config.recursive !== false;
    this._watcherStarted = false;
  }

  static get type() {
    return 'filesystem';
  }

  static get displayName() {
    return 'Local File System';
  }

  static get configSchema() {
    return [
      {
        key: 'path',
        label: 'Documents directory',
        type: 'path',
        required: false,
        default: DEFAULT_DOCS_DIR,
        description: 'Directory containing documents to index. Defaults to ~/gigaclaw-docs/',
      },
      {
        key: 'watch',
        label: 'Watch for changes',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Automatically re-index files when they change',
      },
      {
        key: 'recursive',
        label: 'Include subdirectories',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Recurse into subdirectories',
      },
    ];
  }

  async connect() {
    // Ensure the directory exists
    if (!fs.existsSync(this.docsPath)) {
      fs.mkdirSync(this.docsPath, { recursive: true });
      console.log(`[FilesystemConnector] Created docs directory: ${this.docsPath}`);
    }

    this._connected = true;
    console.log(`[FilesystemConnector] Connected to: ${this.docsPath}`);
  }

  /**
   * List all supported files in the configured directory.
   * @param {Object} [options]
   * @param {string[]} [options.extensions] - Filter by extension
   * @returns {Promise<Array<{id: string, name: string, path: string, size: number, modifiedAt: Date}>>}
   */
  async listFiles(options = {}) {
    if (!this._connected) await this.connect();

    const { extensions } = options;
    const allowedExts = extensions
      ? new Set(extensions.map(e => e.startsWith('.') ? e : `.${e}`))
      : SUPPORTED_EXTENSIONS;

    const files = [];
    this._walkDir(this.docsPath, files, allowedExts);
    return files;
  }

  /**
   * Recursively walk the directory and collect file metadata.
   * @private
   */
  _walkDir(dirPath, files, allowedExts) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // Skip hidden files/dirs

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && this.recursive) {
          this._walkDir(fullPath, files, allowedExts);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext)) {
            const stat = fs.statSync(fullPath);
            files.push({
              id: fullPath,
              name: entry.name,
              path: fullPath,
              size: stat.size,
              modifiedAt: stat.mtime,
            });
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  /**
   * Fetch the content of a file by its path (used as the file ID).
   * @param {string} fileId - Absolute file path
   * @returns {Promise<{text: string, metadata: Object}>}
   */
  async fetchFile(fileId) {
    return extractFile(fileId);
  }

  /**
   * Sync all files in the directory into the RAG knowledge base.
   * @param {Object} [options]
   * @param {boolean} [options.skipIndexed=true]
   * @param {Function} [options.onProgress]
   * @returns {Promise<{synced: number, skipped: number, errors: number}>}
   */
  async sync(options = {}) {
    const { skipIndexed = true, onProgress } = options;

    if (!this._connected) await this.connect();

    const files = await this.listFiles();
    const stats = { synced: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (onProgress) onProgress(i + 1, files.length, file.name);

      if (skipIndexed && isSourceIndexed(file.path)) {
        stats.skipped++;
        continue;
      }

      const result = await ingestFile(file.path);
      if (result.error) {
        stats.errors++;
      } else if (result.skipped) {
        stats.skipped++;
      } else {
        stats.synced++;
      }
    }

    // Start watcher if configured
    if (this.watch && !this._watcherStarted) {
      await startWatcher(this.docsPath);
      this._watcherStarted = true;
    }

    return stats;
  }

  async disconnect() {
    if (this._watcherStarted) {
      stopWatcher();
      this._watcherStarted = false;
    }
    await super.disconnect();
  }

  /**
   * Get the docs directory path.
   * @returns {string}
   */
  get docsDirectory() {
    return this.docsPath;
  }
}
