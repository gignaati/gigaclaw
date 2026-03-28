/**
 * lib/brand.js — Brand Abstraction Layer
 *
 * Single source of truth for all brand strings in GigaClaw.
 *
 * IMPORTANT: This file is imported by Client Components (app-sidebar, etc.)
 * so it MUST NOT use Node.js built-ins (fs, path, process.cwd, etc.).
 * All values here are static — they are the authoritative defaults.
 *
 * For server-side brand overrides (white-labelling via config/brand.json),
 * use lib/brand-server.js which reads from disk at runtime on the server.
 *
 * Architecture principle: BA-ARCH (Brand-Agnostic Architecture)
 */

// Static brand defaults — safe for both client and server bundles
export const brand = {
  name: 'GigaClaw',
  nameLower: 'gigaclaw',
  tagline: "India's Autonomous AI Agent",
  taglineFull: "India's Autonomous AI Agent · Powered by Gignaati",
  description:
    'GigaClaw is an autonomous AI agent platform by Gignaati. Build, deploy, and run AI agents 24/7 with India-first, edge-native AI.',
  company: 'Gignaati',
  companyUrl: 'https://www.gignaati.com',
  packageName: 'gigaclaw',
  npmInstallCmd: 'npx gigaclaw@latest',
  localPort: 3000,
  keywords: ['AI agent', 'autonomous agent', 'Gignaati', 'PragatiGPT', 'India AI', 'edge AI', 'GigaClaw'],
  social: {
    github: 'https://github.com/gignaati/gigaclaw',
    website: 'https://gigaclaw.gignaati.com',
  },
  pragatigpt: {
    label: 'PragatiGPT (Gignaati — India-first)',
    description: 'PragatiGPT — India-first, edge-native AI by Gignaati',
  },
};

// Named convenience exports for the most commonly used fields
export const BRAND_NAME = brand.name;
export const BRAND_TAGLINE = brand.tagline;
export const BRAND_TAGLINE_FULL = brand.taglineFull;
export const BRAND_COMPANY = brand.company;
export const BRAND_COMPANY_URL = brand.companyUrl;
export const BRAND_PACKAGE = brand.packageName;
export const BRAND_DESCRIPTION = brand.description;

export default brand;
