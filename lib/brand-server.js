/**
 * lib/brand-server.js — Server-side Brand Loader
 *
 * Reads config/brand.json at runtime for white-labelling support.
 * This file uses Node.js fs/path and MUST only be imported in Server
 * Components or server-side code. Never import this in Client Components.
 *
 * For client-safe brand constants, use lib/brand.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { brand as defaultBrand } from './brand.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Package-bundled brand.json (authoritative default)
const PACKAGE_BRAND_PATH = path.join(__dirname, '..', 'config', 'brand.json');

// User project brand.json (optional override — allows white-labelling)
const PROJECT_BRAND_PATH = path.join(process.cwd(), 'config', 'brand.json');

function loadBrandFromDisk() {
  // Try user project override first (white-label support)
  if (fs.existsSync(PROJECT_BRAND_PATH)) {
    try {
      const raw = fs.readFileSync(PROJECT_BRAND_PATH, 'utf8');
      return { ...defaultBrand, ...JSON.parse(raw) };
    } catch {
      // Fall through to package default
    }
  }

  // Fall back to package-bundled brand.json
  if (fs.existsSync(PACKAGE_BRAND_PATH)) {
    try {
      const raw = fs.readFileSync(PACKAGE_BRAND_PATH, 'utf8');
      return { ...defaultBrand, ...JSON.parse(raw) };
    } catch {
      // Fall through to static defaults
    }
  }

  return defaultBrand;
}

export const brand = loadBrandFromDisk();
export default brand;
