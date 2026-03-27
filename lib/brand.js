/**
 * lib/brand.js — Brand Abstraction Layer
 *
 * Single source of truth for all brand strings in GigaClaw.
 * Reads from config/brand.json at the project root (process.cwd()).
 * Falls back to the package-bundled config/brand.json if the user's
 * project does not have a custom brand.json.
 *
 * Architecture principle: BA-ARCH (Brand-Agnostic Architecture)
 * Rebranding requires only editing config/brand.json — zero source code changes.
 *
 * Usage:
 *   import { brand } from '../lib/brand.js';
 *   console.log(brand.name);           // "GigaClaw"
 *   console.log(brand.tagline);        // "India's Autonomous AI Agent"
 *   console.log(brand.company);        // "Gignaati"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Package-bundled brand.json (authoritative default)
const PACKAGE_BRAND_PATH = path.join(__dirname, '..', 'config', 'brand.json');

// User project brand.json (optional override — allows white-labelling)
const PROJECT_BRAND_PATH = path.join(process.cwd(), 'config', 'brand.json');

function loadBrand() {
  // Try user project override first (white-label support)
  if (fs.existsSync(PROJECT_BRAND_PATH)) {
    try {
      const raw = fs.readFileSync(PROJECT_BRAND_PATH, 'utf8');
      return JSON.parse(raw);
    } catch {
      // Fall through to package default
    }
  }

  // Fall back to package-bundled brand.json
  if (fs.existsSync(PACKAGE_BRAND_PATH)) {
    try {
      const raw = fs.readFileSync(PACKAGE_BRAND_PATH, 'utf8');
      return JSON.parse(raw);
    } catch {
      // Fall through to hardcoded defaults
    }
  }

  // Last-resort hardcoded defaults (should never be reached in normal operation)
  return {
    name: 'GigaClaw',
    nameLower: 'gigaclaw',
    tagline: "India's Autonomous AI Agent",
    taglineFull: "India's Autonomous AI Agent · Powered by Gignaati",
    description: 'GigaClaw is an autonomous AI agent platform by Gignaati.',
    company: 'Gignaati',
    companyUrl: 'https://www.gignaati.com',
    packageName: 'gigaclaw',
    npmInstallCmd: 'npx gigaclaw@latest',
    localPort: 3000,
    keywords: ['AI agent', 'autonomous agent', 'GigaClaw'],
    social: {
      github: 'https://github.com/gignaati/gigaclaw',
      website: 'https://gigaclaw.gignaati.com',
    },
    pragatigpt: {
      label: 'PragatiGPT (Gignaati — India-first)',
      description: 'PragatiGPT — India-first, edge-native AI by Gignaati',
    },
  };
}

export const brand = loadBrand();

// Named convenience exports for the most commonly used fields
export const BRAND_NAME = brand.name;
export const BRAND_TAGLINE = brand.tagline;
export const BRAND_TAGLINE_FULL = brand.taglineFull;
export const BRAND_COMPANY = brand.company;
export const BRAND_COMPANY_URL = brand.companyUrl;
export const BRAND_PACKAGE = brand.packageName;
export const BRAND_DESCRIPTION = brand.description;

export default brand;
