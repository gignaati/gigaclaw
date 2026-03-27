/**
 * lib/connectors/registry.js — Connector Registry
 *
 * Central registry for all available connectors.
 * Connectors are registered here and can be instantiated by type.
 *
 * Built-in connectors:
 *   filesystem — Local File System (default)
 *
 * Future connectors (v1.8+):
 *   notion     — Notion workspace
 *   github     — GitHub repositories
 *   confluence — Atlassian Confluence
 *   slack      — Slack channels
 *   gdrive     — Google Drive
 */

import { FilesystemConnector } from './filesystem.js';

/**
 * Registry of all available connector classes.
 * Key: connector type string
 * Value: connector class
 */
const REGISTRY = new Map([
  ['filesystem', FilesystemConnector],
]);

/**
 * Register a custom connector class.
 * @param {string} type - Unique type identifier
 * @param {typeof import('./base.js').BaseConnector} ConnectorClass
 */
export function registerConnector(type, ConnectorClass) {
  REGISTRY.set(type, ConnectorClass);
}

/**
 * Get a connector class by type.
 * @param {string} type
 * @returns {typeof import('./base.js').BaseConnector | undefined}
 */
export function getConnectorClass(type) {
  return REGISTRY.get(type);
}

/**
 * List all registered connector types with their display names.
 * @returns {Array<{type: string, displayName: string, configSchema: Array}>}
 */
export function listConnectors() {
  return Array.from(REGISTRY.entries()).map(([type, cls]) => ({
    type,
    displayName: cls.displayName,
    configSchema: cls.configSchema,
  }));
}

/**
 * Create a connector instance by type.
 * @param {string} type - Connector type
 * @param {Object} config - Connector configuration
 * @returns {import('./base.js').BaseConnector}
 * @throws {Error} If connector type is not registered
 */
export function createConnector(type, config = {}) {
  const ConnectorClass = REGISTRY.get(type);
  if (!ConnectorClass) {
    throw new Error(`Unknown connector type: "${type}". Available: ${[...REGISTRY.keys()].join(', ')}`);
  }
  return new ConnectorClass(config);
}

/**
 * Create and connect the default filesystem connector.
 * @param {Object} [config]
 * @returns {Promise<import('./filesystem.js').FilesystemConnector>}
 */
export async function createDefaultConnector(config = {}) {
  const connector = new FilesystemConnector(config);
  await connector.connect();
  return connector;
}
