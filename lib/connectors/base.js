/**
 * lib/connectors/base.js — BaseConnector Interface
 *
 * All GigaClaw connectors extend this base class.
 * A connector bridges an external data source (filesystem, Notion, GitHub,
 * Confluence, etc.) to the RAG ingestion pipeline.
 *
 * Connector lifecycle:
 *   1. connect()    — establish connection, validate credentials
 *   2. listFiles()  — enumerate available documents
 *   3. fetchFile()  — retrieve a single document's content
 *   4. sync()       — full sync: list + fetch + ingest all documents
 *   5. disconnect() — clean up resources
 *
 * Implementing a new connector:
 *   1. Extend BaseConnector
 *   2. Override all abstract methods
 *   3. Register in lib/connectors/registry.js
 *   4. Add a setup step in setup/setup.mjs
 */

export class BaseConnector {
  /**
   * @param {Object} config - Connector-specific configuration
   * @param {string} config.id - Unique connector instance ID
   * @param {string} config.name - Human-readable connector name
   */
  constructor(config = {}) {
    this.id = config.id || this.constructor.name.toLowerCase();
    this.name = config.name || this.constructor.name;
    this.config = config;
    this._connected = false;
  }

  /**
   * Connector type identifier. Override in subclasses.
   * @returns {string}
   */
  static get type() {
    return 'base';
  }

  /**
   * Human-readable display name for the connector.
   * @returns {string}
   */
  static get displayName() {
    return 'Base Connector';
  }

  /**
   * Configuration schema for the setup wizard.
   * Return an array of field descriptors.
   * @returns {Array<{key: string, label: string, type: 'text' | 'password' | 'path' | 'boolean', required: boolean, default?: any}>}
   */
  static get configSchema() {
    return [];
  }

  /**
   * Establish connection to the data source.
   * Validate credentials and test connectivity.
   * @returns {Promise<void>}
   * @throws {Error} If connection fails
   */
  async connect() {
    throw new Error(`${this.constructor.name}.connect() not implemented`);
  }

  /**
   * List all documents available from this connector.
   * @param {Object} [options]
   * @param {string} [options.path] - Filter to a specific path/folder
   * @param {string[]} [options.extensions] - Filter by file extension
   * @returns {Promise<Array<{id: string, name: string, path: string, size: number, modifiedAt: Date, mimeType?: string}>>}
   */
  async listFiles(options = {}) {
    throw new Error(`${this.constructor.name}.listFiles() not implemented`);
  }

  /**
   * Fetch the content of a single document.
   * @param {string} fileId - File identifier from listFiles()
   * @returns {Promise<{text: string, metadata: Object}>}
   */
  async fetchFile(fileId) {
    throw new Error(`${this.constructor.name}.fetchFile() not implemented`);
  }

  /**
   * Perform a full sync: list all files, fetch content, ingest into RAG.
   * Default implementation calls listFiles() + fetchFile() for each file.
   * Override for connectors with bulk export APIs.
   *
   * @param {Object} [options]
   * @param {boolean} [options.skipIndexed=true] - Skip files already in vector store
   * @param {Function} [options.onProgress] - Callback(current, total, fileName)
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

      try {
        const { text, metadata } = await this.fetchFile(file.id);
        if (!text || text.trim().length === 0) {
          stats.skipped++;
          continue;
        }

        // Lazy import to avoid circular dependency
        const { ingest } = await import('../rag/index.js');
        // Write to a temp path for ingestion
        const { default: os } = await import('os');
        const { default: path } = await import('path');
        const { default: fs } = await import('fs');
        const tmpPath = path.join(os.tmpdir(), `gigaclaw-connector-${Date.now()}-${file.name}`);
        fs.writeFileSync(tmpPath, text, 'utf8');

        try {
          await ingest(tmpPath);
          stats.synced++;
        } finally {
          fs.unlinkSync(tmpPath);
        }
      } catch (err) {
        console.error(`[Connector:${this.id}] Error syncing ${file.name}: ${err.message}`);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Clean up resources (close connections, clear caches).
   * @returns {Promise<void>}
   */
  async disconnect() {
    this._connected = false;
  }

  /**
   * Check if the connector is currently connected.
   * @returns {boolean}
   */
  get isConnected() {
    return this._connected;
  }

  /**
   * Validate the connector configuration.
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateConfig() {
    const schema = this.constructor.configSchema;
    const errors = [];

    for (const field of schema) {
      if (field.required && !this.config[field.key]) {
        errors.push(`Missing required field: ${field.key}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
