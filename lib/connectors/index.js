/**
 * lib/connectors/index.js — Connector Framework Public API
 *
 * Export all connector classes and registry functions.
 */

export { BaseConnector } from './base.js';
export { FilesystemConnector } from './filesystem.js';
export {
  registerConnector,
  getConnectorClass,
  listConnectors,
  createConnector,
  createDefaultConnector,
} from './registry.js';
