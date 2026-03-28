/**
 * scaffold.mjs — extracted project scaffolding logic
 *
 * Used by both bin/cli.js (gigaclaw init) and bin/bootstrap.mjs (npx gigaclaw@latest).
 * Returns { created, skipped, changed, updated } arrays.
 */

import fs from 'fs';
import path from 'path';
import { createDirLink } from '../setup/lib/fs-utils.mjs';

// Files tightly coupled to the package version that are auto-updated by init.
const MANAGED_PATHS = [
  '.github/workflows/',
  'docker/event-handler/',
  'docker/claude-code-job/',
  'docker/claude-code-workspace/',
  'docker/pi-coding-agent-job/',
  'docker-compose.yml',
  'docker-compose.local.yml',
  '.dockerignore',
  'CLAUDE.md',
  'middleware.js',
];

// Files that are only relevant in cloud mode.
const CLOUD_ONLY_PATHS = ['.github/workflows/'];

// Files that must never be scaffolded directly.
const EXCLUDED_FILENAMES = ['CLAUDE.md'];

function isManaged(relPath) {
  return MANAGED_PATHS.some(p => relPath === p || relPath.startsWith(p));
}

function destPath(templateRelPath) {
  if (templateRelPath.endsWith('.template')) {
    return templateRelPath.slice(0, -'.template'.length);
  }
  return templateRelPath;
}

function getTemplateFiles(templatesDir) {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip symlinks — they are recreated explicitly below (e.g. .claude/skills, .pi/skills)
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (!EXCLUDED_FILENAMES.includes(entry.name)) {
        files.push(path.relative(templatesDir, fullPath));
      }
    }
  }
  walk(templatesDir);
  return files;
}

/**
 * Scaffold a gigaclaw project into `cwd`.
 *
 * @param {string} cwd - target directory
 * @param {string} packageDir - gigaclaw package root
 * @param {object} options
 * @param {boolean} [options.noManaged=false] - skip auto-updating managed files
 * @param {boolean} [options.silent=false] - suppress per-file console output
 * @returns {{ created: string[], skipped: string[], changed: string[], updated: string[] }}
 */
export async function scaffoldProject(cwd, packageDir, { noManaged = false, silent = false } = {}) {
  const templatesDir = path.join(packageDir, 'templates');

  const created = [];
  const skipped = [];
  const changed = [];
  const updated = [];

  // Detect mode from existing .env
  const existingEnvPath = path.join(cwd, '.env');
  let gigaclawMode = 'cloud';
  if (fs.existsSync(existingEnvPath)) {
    const envContent = fs.readFileSync(existingEnvPath, 'utf-8');
    const modeMatch = envContent.match(/^GIGACLAW_MODE=(.*)$/m);
    if (modeMatch && modeMatch[1].trim() === 'local') gigaclawMode = 'local';
  }

  const templateFiles = getTemplateFiles(templatesDir);

  for (const relPath of templateFiles) {
    const src = path.join(templatesDir, relPath);
    const outPath = destPath(relPath);
    const dest = path.join(cwd, outPath);

    if (gigaclawMode === 'local' && CLOUD_ONLY_PATHS.some(p => outPath === p || outPath.startsWith(p))) {
      continue;
    }

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      created.push(outPath);
      if (!silent) console.log(`  Created ${outPath}`);
    } else {
      const srcContent = fs.readFileSync(src);
      const destContent = fs.readFileSync(dest);
      if (srcContent.equals(destContent)) {
        skipped.push(outPath);
      } else if (!noManaged && isManaged(outPath)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        updated.push(outPath);
        if (!silent) console.log(`  Updated ${outPath}`);
      } else {
        changed.push(outPath);
        if (!silent) console.log(`  Skipped ${outPath} (already exists)`);
      }
    }
  }

  // Create package.json if missing
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const dirName = path.basename(cwd);
    const { version } = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    const gigaclawDep = version.includes('-') ? version : `^${version}`;
    const pkg = {
      name: dirName,
      private: true,
      scripts: {
        dev: 'next dev --turbopack',
        build: 'next build',
        start: 'next start',
        setup: 'gigaclaw setup',
        'setup-telegram': 'gigaclaw setup-telegram',
        'reset-auth': 'gigaclaw reset-auth',
      },
      dependencies: {
        gigaclaw: gigaclawDep,
        next: '^15.5.12',
        'next-auth': '5.0.0-beta.30',
        'next-themes': '^0.4.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        tailwindcss: '^4.0.0',
        '@tailwindcss/postcss': '^4.0.0',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    created.push('package.json');
    if (!silent) console.log('  Created package.json');
  }

  // Create .gitkeep files for empty dirs
  const gitkeepDirs = ['cron', 'triggers', 'logs', 'tmp', 'data'];
  for (const dir of gitkeepDirs) {
    const gitkeep = path.join(cwd, dir, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      fs.mkdirSync(path.join(cwd, dir), { recursive: true });
      fs.writeFileSync(gitkeep, '');
    }
  }

  // Create default skill activation symlinks
  const defaultSkills = ['browser-tools', 'llm-secrets', 'modify-self'];
  const activeDir = path.join(cwd, 'skills', 'active');
  fs.mkdirSync(activeDir, { recursive: true });
  for (const skill of defaultSkills) {
    const symlink = path.join(activeDir, skill);
    if (!fs.existsSync(symlink)) {
      createDirLink(`../${skill}`, symlink);
    }
  }

  // Create .pi/skills and .claude/skills symlinks
  for (const [linkPath, target] of [
    [path.join(cwd, '.pi', 'skills'), '../skills/active'],
    [path.join(cwd, '.claude', 'skills'), '../skills/active'],
  ]) {
    if (!fs.existsSync(linkPath)) {
      fs.mkdirSync(path.dirname(linkPath), { recursive: true });
      createDirLink(target, linkPath);
    }
  }

  return { created, skipped, changed, updated };
}
