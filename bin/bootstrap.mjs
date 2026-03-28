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
  ENV:    '[ 1/8 ] Detecting environment',
  DIR:    '[ 2/8 ] Creating project directory',
  SCAF:   '[ 3/8 ] Scaffolding project files',
  DEPS:   '[ 4/8 ] Installing dependencies',
  SETUP:  '[ 5/8 ] Configuring GigaClaw',
  ENV_W:  '[ 6/8 ] Writing .env',
  START:  '[ 7/8 ] Starting dev server',
  HEALTH: '[ 8/8 ] Validating system health',
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
  // Support --clean-install: delete node_modules and lockfile before install
  if (process.env.GIGACLAW_CLEAN_INSTALL === 'true') {
    logStep('Clean install requested — removing node_modules and lockfile...');
    const nm = path.join(cwd, 'node_modules');
    const lf = path.join(cwd, 'package-lock.json');
    if (fs.existsSync(nm)) fs.rmSync(nm, { recursive: true, force: true });
    if (fs.existsSync(lf)) fs.unlinkSync(lf);
  }
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

async function runSmartSetup(cwd, envInfo, port = 3000) {
  const { randomBytes } = await import('crypto');

  const authSecret = randomBytes(32).toString('base64url');
  const nextAuthSecret = randomBytes(32).toString('base64url');
  const jwtSecret = randomBytes(32).toString('base64url');

  const localModel = envInfo.ollamaModels.length > 0
    ? envInfo.ollamaModels[0]
    : recommendOllamaModel(envInfo.ramGb);

  // Determine operating mode based on available infrastructure
  // If an existing .env has ANTHROPIC_API_KEY, preserve hybrid mode
  const existingEnv = fs.existsSync(path.join(cwd, '.env'))
    ? fs.readFileSync(path.join(cwd, '.env'), 'utf-8')
    : '';
  const hasApiKey = /^ANTHROPIC_API_KEY=.+$/m.test(existingEnv)
    || /^OPENAI_API_KEY=.+$/m.test(existingEnv)
    || /^GOOGLE_API_KEY=.+$/m.test(existingEnv);
  const hasOllama = envInfo.ollama;

  let mode, llmProvider, llmModel;
  if (hasApiKey) {
    // User has a cloud API key — use hybrid mode
    mode = 'hybrid';
    llmProvider = 'anthropic';
    llmModel = 'claude-sonnet-4-6';
  } else if (hasOllama) {
    // No cloud key but Ollama is running — local-only mode
    mode = 'local';
    llmProvider = 'ollama';
    llmModel = localModel;
  } else {
    // No cloud key, no Ollama — local mode with placeholder (UI will still load)
    mode = 'local';
    llmProvider = 'ollama';
    llmModel = localModel;
  }

  const envVars = {
    // Mode — auto-detected based on available infrastructure
    GIGACLAW_MODE: mode,

    // Primary LLM
    LLM_PROVIDER: llmProvider,
    LLM_MODEL: llmModel,
    // Cloud API key — only set if not already present
    ...(hasApiKey ? {} : { ANTHROPIC_API_KEY: '' }),

    // Local: Ollama if running, else blank
    LOCAL_LLM_PROVIDER: hasOllama ? 'ollama' : '',
    LOCAL_LLM_MODEL: hasOllama ? localModel : '',
    OLLAMA_BASE_URL: 'http://localhost:11434',

    // Routing
    HYBRID_ROUTING: mode === 'hybrid' ? 'auto' : 'local',

    // Auth & JWT
    NEXTAUTH_URL: `http://localhost:${port}`,
    AUTH_URL: `http://localhost:${port}`,
    NEXTAUTH_SECRET: nextAuthSecret,
    AUTH_SECRET: authSecret,
    JWT_SECRET: jwtSecret,
    AUTH_TRUST_HOST: 'true',

    // Cron control — disabled until health check passes
    ENABLE_CRON: 'false',

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

async function findFreePort(preferred = 3000) {
  const net = await import('net');
  for (let port = preferred; port < preferred + 20; port++) {
    const free = await new Promise((resolve) => {
      const srv = net.default.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => { srv.close(); resolve(true); });
      srv.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  return preferred; // fallback
}

async function startDevServer(cwd, port) {
  // port is pre-detected before setup so NEXTAUTH_URL matches
  if (!port) port = await findFreePort(3000);
  const APP_URL = `http://localhost:${port}`;

  if (port !== 3000) {
    logWarn(`Port 3000 is in use — using port ${port}`);
  }

  // Read mode from .env for the info box
  let displayMode = 'Local';
  try {
    const envContent = fs.readFileSync(path.join(cwd, '.env'), 'utf-8');
    const modeMatch = envContent.match(/^GIGACLAW_MODE=(.*)$/m);
    if (modeMatch && modeMatch[1].trim() === 'hybrid') displayMode = 'Hybrid (Cloud + Local)';
    else if (modeMatch && modeMatch[1].trim() === 'local') displayMode = 'Local (On-Device)';
  } catch (_) {}

  const modeStr = `Mode:     ${displayMode}`;
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   GigaClaw is starting...                               │
  │                                                         │
  │   App URL:  http://localhost:${port}${' '.repeat(Math.max(0, 22 - String(port).length))}│
  │   ${modeStr}${' '.repeat(Math.max(0, 52 - modeStr.length))}│
  │                                                         │
  │   Run: npm run setup  for the full wizard               │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
`);

  // Clean stale .next build cache to avoid chunk load errors
  const nextDir = path.join(cwd, '.next');
  if (fs.existsSync(nextDir)) {
    logStep('Removing stale .next build cache...');
    fs.rmSync(nextDir, { recursive: true, force: true });
  }

  logStep(`Launching Next.js dev server on port ${port}...`);

  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
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

      // Detect server ready signals
      if (!serverReady && (
        (text.includes('Local:') && text.includes(`localhost:${port}`)) ||
        text.includes('Ready in') ||
        text.includes('\u2713 Ready') ||
        text.includes('started server on')
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
      let dirName = 'gigaclaw-app';
      let newDir = path.resolve(cwd, dirName);
      // If gigaclaw-app already exists and is not a gigaclaw project, use a unique suffix
      if (fs.existsSync(newDir)) {
        const existingPkg = path.join(newDir, 'package.json');
        let isGigaclawDir = false;
        if (fs.existsSync(existingPkg)) {
          try {
            const p = JSON.parse(fs.readFileSync(existingPkg, 'utf8'));
            if (p.dependencies?.gigaclaw || p.devDependencies?.gigaclaw) isGigaclawDir = true;
          } catch (_) {}
        }
        if (!isGigaclawDir) {
          const suffix = Date.now().toString(36).slice(-4);
          dirName = `gigaclaw-app-${suffix}`;
          newDir = path.resolve(cwd, dirName);
        }
      }
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

  // ── Detect port early so NEXTAUTH_URL is written correctly ────────────────
  const devPort = await findFreePort(3000);
  if (devPort !== 3000) {
    logWarn(`Port 3000 is in use — will use port ${devPort} for the dev server`);
  }

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
    log(PHASES.SETUP, 'Applying smart defaults (auto-detecting mode)...');
    const { localModel, envVars: setupVars } = await runSmartSetup(cwd, envInfo, devPort);

    log(PHASES.ENV_W, 'Writing .env configuration...');
    logOk(`GIGACLAW_MODE=${setupVars.GIGACLAW_MODE}`);
    logOk(`LLM_PROVIDER=${setupVars.LLM_PROVIDER} | LLM_MODEL=${setupVars.LLM_MODEL}`);
    if (setupVars.LOCAL_LLM_PROVIDER) {
      logOk(`LOCAL_LLM_PROVIDER=${setupVars.LOCAL_LLM_PROVIDER} | LOCAL_LLM_MODEL=${setupVars.LOCAL_LLM_MODEL}`);
    }
    logOk(`HYBRID_ROUTING=${setupVars.HYBRID_ROUTING}`);
    if (setupVars.GIGACLAW_MODE === 'local' && !envInfo.ollama) {
      logWarn('No API key and no Ollama detected — UI will load but AI chat requires a provider');
      logStep('To enable AI: install Ollama (https://ollama.com) or add ANTHROPIC_API_KEY to .env');
    } else if (setupVars.GIGACLAW_MODE === 'local') {
      logOk('Running in local-only mode — all data stays on your machine');
    } else if (!setupVars.ANTHROPIC_API_KEY && setupVars.GIGACLAW_MODE === 'hybrid') {
      logWarn('ANTHROPIC_API_KEY is empty — run: npm run setup  to add your API key');
    }
  }

  // ── Phase 7: Start dev server + open browser ─────────────────────────────────────────
  log(PHASES.START, 'Starting Next.js dev server...');

  const serverChild = await startDevServer(cwd, devPort);

  // ── Phase 8: Health validation ─────────────────────────────────────────────
  log(PHASES.HEALTH, 'Validating system health...');
  const healthUrl = `http://localhost:${devPort}/api/health`;
  let healthPassed = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await SLEEP(3000); // Give Next.js time to compile the route
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        healthPassed = data.status !== 'unhealthy';
        if (healthPassed) {
          logOk(`Health check passed — status: ${data.status}`);
          // Print subsystem summary
          for (const [name, check] of Object.entries(data.checks || {})) {
            const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
            logStep(`${icon} ${name}: ${check.message}`);
          }
          // Enable cron now that system is healthy
          try {
            const envPath = path.join(cwd, '.env');
            let envContent = fs.readFileSync(envPath, 'utf-8');
            envContent = envContent.replace(/^ENABLE_CRON=false$/m, 'ENABLE_CRON=true');
            fs.writeFileSync(envPath, envContent);
            logOk('Cron scheduler enabled (ENABLE_CRON=true)');
          } catch (_) {}
          break;
        } else {
          logWarn(`Health check returned: ${data.status} (attempt ${attempt}/5)`);
        }
      } else {
        logWarn(`Health check returned HTTP ${res.status} (attempt ${attempt}/5)`);
      }
    } catch (err) {
      if (attempt < 5) {
        logStep(`Health check attempt ${attempt}/5 — server still compiling...`);
      } else {
        logWarn(`Health check failed after 5 attempts: ${err.message}`);
      }
    }
  }

  if (!healthPassed) {
    logWarn('Health check did not pass — system may be degraded.');
    logStep('Run: curl http://localhost:' + devPort + '/api/health  to diagnose');
    logStep('Run: curl http://localhost:' + devPort + '/api/debug   for full diagnostics');
  }

  // Final summary
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   ✓ GigaClaw is ready!                                  │
  │                                                         │
  │   App:     http://localhost:${devPort}${' '.repeat(Math.max(0, 22 - String(devPort).length))}│
  │   Health:  http://localhost:${devPort}/api/health${' '.repeat(Math.max(0, 11 - String(devPort).length))}│
  │   Debug:   http://localhost:${devPort}/api/debug${' '.repeat(Math.max(0, 12 - String(devPort).length))}│
  │                                                         │
  │   Press Ctrl+C to stop the server                       │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
`);
}
