#!/usr/bin/env node
/**
 * GigaClaw One-Command Bootstrap — v1.9.0
 *
 * Invoked when user runs: npx gigaclaw@latest (no subcommand)
 *
 * Flow:
 *   1. Detect environment (Node, Docker, Ollama)
 *   2. Auto-create project directory (default: ./gigaclaw-app, or cwd if empty)
 *   3. Run scaffolding silently
 *   4. Reliable dependency installation (retry + cache clean + pnpm fallback)
 *   5. Auto-run setup with smart defaults (hybrid mode, Claude Sonnet, auto routing)
 *   6. Write .env automatically
 *   7. Start dev server and auto-open browser
 *
 * Pass --interactive to enable the full interactive setup wizard instead of smart defaults.
 */

import { execSync, execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_DIR = path.join(__dirname, '..');

// ─── Structured Logger ────────────────────────────────────────────────────────
// Replaces verbose npm/node output with clean phase-aware status lines.

const PHASES = {
  ENV:    '[ 1/7 ] Detecting environment',
  DIR:    '[ 2/7 ] Creating project directory',
  SCAF:   '[ 3/7 ] Scaffolding project files',
  DEPS:   '[ 4/7 ] Installing dependencies',
  SETUP:  '[ 5/7 ] Configuring GigaClaw',
  ENV_W:  '[ 6/7 ] Writing .env',
  START:  '[ 7/7 ] Starting dev server',
};

function log(phase, msg) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  process.stdout.write(`\n  ${phase}\n  ${ts}  ${msg}\n`);
}

function logStep(msg) {
  process.stdout.write(`        → ${msg}\n`);
}

function logOk(msg) {
  process.stdout.write(`        ✓ ${msg}\n`);
}

function logWarn(msg) {
  process.stdout.write(`        ⚠ ${msg}\n`);
}

function logErr(msg) {
  process.stderr.write(`        ✗ ${msg}\n`);
}

function printBanner() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8'));
  console.log(`
   _______             ________
  / ____(_)___ _____ _/ ____/ /___ _      __
 / / __/ / __ \\/ __ \`/ /   / / __ \\ | /| / /
/ /_/ / / /_/ / /_/ / /___/ / /_/ / |/ |/ /
\\____/_/\\__, /\\__,_/\\____/_/\\____/|__/|__/
       /____/

  India's Autonomous AI Agent · Powered by Gignaati
  v${pkg.version} — One-Command Bootstrap
`);
}

// ─── Section 1: Reliable Dependency Installation ─────────────────────────────

const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

async function installDependencies(cwd) {
  const MAX_ATTEMPTS = 3;
  const BACKOFF = [2000, 5000, 10000]; // exponential: 2s, 5s, 10s

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      logStep(`npm install attempt ${attempt}/${MAX_ATTEMPTS}...`);

      // On retry: clean cache and remove node_modules + lock file to start fresh
      if (attempt > 1) {
        logStep('Cleaning npm cache before retry...');
        try {
          execSync('npm cache clean --force', { stdio: 'pipe', cwd, shell: true });
        } catch (_) { /* non-fatal */ }

        const nmPath = path.join(cwd, 'node_modules');
        const lockPath = path.join(cwd, 'package-lock.json');
        if (fs.existsSync(nmPath)) {
          logStep('Removing node_modules...');
          fs.rmSync(nmPath, { recursive: true, force: true });
        }
        if (fs.existsSync(lockPath)) {
          logStep('Removing package-lock.json...');
          fs.rmSync(lockPath);
        }

        const delay = BACKOFF[attempt - 2] || 10000;
        logStep(`Waiting ${delay / 1000}s before retry...`);
        await SLEEP(delay);
      }

      execSync(
        'npm install --no-audit --no-fund --prefer-online',
        { stdio: 'pipe', cwd, shell: true }
      );
      logOk('Dependencies installed successfully.');
      return;
    } catch (err) {
      logWarn(`npm install attempt ${attempt} failed: ${err.message.split('\n')[0]}`);
    }
  }

  // All npm attempts failed — try pnpm fallback
  logWarn('All npm attempts failed. Trying pnpm fallback...');
  try {
    execSync('pnpm --version', { stdio: 'pipe', shell: true });
    logStep('pnpm detected — running pnpm install...');
    execSync('pnpm install --prefer-offline', { stdio: 'inherit', cwd, shell: true });
    logOk('Dependencies installed via pnpm.');
    return;
  } catch (_) {
    logErr('pnpm not available or also failed.');
  }

  logErr('Dependency installation failed after 3 attempts + pnpm fallback.');
  logErr('Please check your network connection and run: npm install');
  process.exit(1);
}

// ─── Section 2: Environment Detection ────────────────────────────────────────

async function detectEnvironment() {
  const env = {
    nodeVersion: process.version,
    platform: process.platform,
    docker: false,
    ollama: false,
    ollamaModels: [],
    ramGb: Math.floor(os.totalmem() / (1024 ** 3)),
  };

  // Docker
  try {
    execSync('docker --version', { stdio: 'pipe', shell: true });
    env.docker = true;
  } catch (_) {}

  // Ollama
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      env.ollama = true;
      const data = await res.json();
      env.ollamaModels = (data.models || []).map((m) => m.name);
    }
  } catch (_) {}

  return env;
}

function recommendOllamaModel(ramGb) {
  if (ramGb >= 32) return 'llama3.1:8b';
  if (ramGb >= 16) return 'llama3.1:8b';
  return 'llama3.2:3b';
}

// ─── Section 2: Smart Defaults Setup (non-interactive) ───────────────────────

async function runSmartSetup(cwd, envInfo) {
  const { randomBytes } = await import('crypto');

  const authSecret = randomBytes(32).toString('base64url');
  const nextAuthSecret = randomBytes(32).toString('base64url');

  const localModel = envInfo.ollamaModels.length > 0
    ? envInfo.ollamaModels[0]
    : recommendOllamaModel(envInfo.ramGb);

  const envVars = {
    // Mode
    GIGACLAW_MODE: 'hybrid',

    // Cloud: default to Claude Sonnet (user can change via npm run setup)
    LLM_PROVIDER: 'anthropic',
    LLM_MODEL: 'claude-sonnet-4-6',
    // Note: ANTHROPIC_API_KEY intentionally left blank — user must provide it
    ANTHROPIC_API_KEY: '',

    // Local: Ollama if running, else blank
    LOCAL_LLM_PROVIDER: envInfo.ollama ? 'ollama' : '',
    LOCAL_LLM_MODEL: envInfo.ollama ? localModel : '',
    OLLAMA_BASE_URL: 'http://localhost:11434',

    // Routing
    HYBRID_ROUTING: 'auto',

    // Auth
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: nextAuthSecret,
    AUTH_SECRET: authSecret,
    AUTH_TRUST_HOST: 'true',

    // Version
    GIGACLAW_VERSION: JSON.parse(
      fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')
    ).version,
  };

  // Write .env
  const envPath = path.join(cwd, '.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  for (const [key, value] of Object.entries(envVars)) {
    // Don't overwrite existing non-empty values (preserves user's API keys on re-run)
    const regex = new RegExp(`^${key}=(.*)$`, 'm');
    const match = content.match(regex);
    if (match && match[1].trim()) {
      // Already set — skip
      continue;
    }
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, content);
  return { localModel, envVars };
}

// ─── Section 4+5: Auto Start Dev Server + Auto Open Browser ─────────────────

function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      execSync(`start ${url}`, { stdio: 'pipe', shell: true });
    } else if (platform === 'darwin') {
      execSync(`open ${url}`, { stdio: 'pipe', shell: true });
    } else {
      execSync(`xdg-open ${url}`, { stdio: 'pipe', shell: true });
    }
    logOk(`Browser opened at ${url}`);
  } catch (_) {
    logWarn(`Could not auto-open browser. Visit manually: ${url}`);
  }
}

async function startDevServer(cwd) {
  const APP_URL = 'http://localhost:3000';

  logStep('Launching Next.js dev server (turbopack)...');

  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let serverReady = false;
  let output = '';

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!serverReady) {
        logWarn('Server startup timed out after 120s. Check logs manually.');
        logWarn(`Run: cd ${cwd} && npm run dev`);
        resolve();
      }
    }, 120_000);

    function onData(chunk) {
      const text = chunk.toString();
      output += text;

      // Forward server output with indent
      for (const line of text.split('\n')) {
        if (line.trim()) process.stdout.write(`        ${line}\n`);
      }

      // Detect "Local: http://localhost:3000" — server is ready
      if (!serverReady && (
        text.includes('Local:') && text.includes('localhost:3000') ||
        text.includes('Ready in') ||
        text.includes('✓ Ready')
      )) {
        serverReady = true;
        clearTimeout(timeout);
        logOk(`Dev server ready at ${APP_URL}`);
        openBrowser(APP_URL);
        resolve(child);
      }
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('error', (err) => {
      clearTimeout(timeout);
      logErr(`Dev server failed to start: ${err.message}`);
      reject(err);
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (!serverReady) {
        logErr(`Dev server exited with code ${code}`);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

// ─── Main Bootstrap Orchestrator ─────────────────────────────────────────────

export async function bootstrap() {
  const interactive = process.argv.includes('--interactive');

  printBanner();

  // ── Phase 1: Detect environment ──────────────────────────────────────────
  log(PHASES.ENV, 'Checking Node.js, Docker, Ollama...');

  const envInfo = await detectEnvironment();

  logOk(`Node.js ${envInfo.nodeVersion}`);
  logOk(`Platform: ${envInfo.platform} | RAM: ${envInfo.ramGb} GB`);

  if (envInfo.docker) {
    logOk('Docker: available');
  } else {
    logWarn('Docker: not found (optional — needed for cloud agent mode)');
  }

  if (envInfo.ollama) {
    logOk(`Ollama: running — ${envInfo.ollamaModels.length} model(s) available`);
    if (envInfo.ollamaModels.length > 0) {
      logStep(`Models: ${envInfo.ollamaModels.slice(0, 3).join(', ')}${envInfo.ollamaModels.length > 3 ? '...' : ''}`);
    }
  } else {
    logWarn('Ollama: not running (optional — enables local AI mode)');
    logStep('Install: https://ollama.com/download');
  }

  // ── Phase 2: Determine project directory ─────────────────────────────────
  log(PHASES.DIR, 'Preparing project directory...');

  let cwd = process.cwd();
  const entries = fs.readdirSync(cwd).filter(e => !e.startsWith('.'));

  if (entries.length > 0) {
    // Non-empty directory — check if it's already a gigaclaw project
    const pkgPath = path.join(cwd, 'package.json');
    let isExistingProject = false;
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.gigaclaw) isExistingProject = true;
      } catch (_) {}
    }

    if (!isExistingProject) {
      const dirName = 'gigaclaw-app';
      const newDir = path.resolve(cwd, dirName);
      fs.mkdirSync(newDir, { recursive: true });
      process.chdir(newDir);
      cwd = newDir;
      logOk(`Created ${dirName}/ (current directory was not empty)`);
    } else {
      logOk(`Existing GigaClaw project detected — updating in place`);
    }
  } else {
    logOk(`Using current directory: ${path.basename(cwd)}`);
  }

  // ── Phase 3: Scaffolding ─────────────────────────────────────────────────
  log(PHASES.SCAF, 'Copying project templates...');

  // Dynamically import init logic from cli.js by re-using the scaffolding function
  // We call the init logic directly to avoid spawning a child process
  const { scaffoldProject } = await import('./scaffold.mjs');
  const { created, updated } = await scaffoldProject(cwd, PACKAGE_DIR);

  if (created.length > 0) logOk(`Created ${created.length} file(s)`);
  if (updated.length > 0) logOk(`Updated ${updated.length} managed file(s)`);
  if (created.length === 0 && updated.length === 0) logOk('All files up to date');

  // ── Phase 4: Install dependencies ───────────────────────────────────────
  log(PHASES.DEPS, 'Installing npm packages (retry-safe)...');
  await installDependencies(cwd);

  // ── Phase 5+6: Setup + .env ──────────────────────────────────────────────
  if (interactive) {
    log(PHASES.SETUP, 'Launching interactive setup wizard...');
    const setupScript = path.join(PACKAGE_DIR, 'setup', 'setup.mjs');
    try {
      execFileSync(process.execPath, [setupScript], { stdio: 'inherit', cwd });
    } catch (e) {
      logErr(`Setup wizard failed: ${e.message}`);
      process.exit(1);
    }
  } else {
    log(PHASES.SETUP, 'Applying smart defaults (hybrid mode, Claude Sonnet, auto routing)...');
    const { localModel } = await runSmartSetup(cwd, envInfo);

    log(PHASES.ENV_W, 'Writing .env configuration...');
    logOk('GIGACLAW_MODE=hybrid');
    logOk('LLM_PROVIDER=anthropic | LLM_MODEL=claude-sonnet-4-6');
    logOk(`LOCAL_LLM_PROVIDER=${envInfo.ollama ? 'ollama' : '(not configured)'} | LOCAL_LLM_MODEL=${envInfo.ollama ? localModel : '(not configured)'}`);
    logOk('HYBRID_ROUTING=auto');
    logWarn('ANTHROPIC_API_KEY is empty — run: npm run setup  to add your API key');
  }

  // ── Phase 7: Start dev server + open browser ─────────────────────────────
  log(PHASES.START, 'Starting Next.js dev server...');

  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   GigaClaw is starting...                               │
  │                                                         │
  │   App URL:  http://localhost:3000                       │
  │   Mode:     Hybrid (Cloud + Local)                      │
  │                                                         │
  │   Next step: add your ANTHROPIC_API_KEY to .env         │
  │   or run:   npm run setup  for the full wizard          │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
`);

  await startDevServer(cwd);
}
