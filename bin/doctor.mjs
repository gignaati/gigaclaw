#!/usr/bin/env node

/**
 * gigaclaw doctor — Environment validation command.
 *
 * Checks:
 *   - Node.js version (>= 18 required, >= 20 recommended)
 *   - Docker availability
 *   - Ollama availability and models
 *   - Port 3000 availability
 *   - .env file completeness
 *   - npm cache health
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';

const OK = '\x1b[32m✓\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';

function check(icon, label, detail) {
  console.log(`  ${icon}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

export async function doctor() {
  console.log('\n  GigaClaw Doctor — Environment Validation\n');
  console.log('  ─────────────────────────────────────────\n');

  let issues = 0;

  // 1. Node.js
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  if (major >= 20) {
    check(OK, 'Node.js', `${nodeVersion} (recommended)`);
  } else if (major >= 18) {
    check(WARN, 'Node.js', `${nodeVersion} (works, but v20+ recommended)`);
  } else {
    check(FAIL, 'Node.js', `${nodeVersion} (v18+ required)`);
    issues++;
  }

  // 2. npm
  const npmVersion = tryExec('npm --version');
  if (npmVersion) {
    check(OK, 'npm', `v${npmVersion}`);
  } else {
    check(FAIL, 'npm', 'not found');
    issues++;
  }

  // 3. Docker
  const dockerVersion = tryExec('docker --version');
  if (dockerVersion) {
    const dockerRunning = tryExec('docker info');
    if (dockerRunning) {
      check(OK, 'Docker', dockerVersion.replace('Docker version ', 'v'));
    } else {
      check(WARN, 'Docker', 'installed but daemon not running');
    }
  } else {
    check(WARN, 'Docker', 'not installed (optional — needed for code execution sandbox)');
  }

  // 4. Ollama
  const ollamaVersion = tryExec('ollama --version');
  if (ollamaVersion) {
    const ollamaModels = tryExec('ollama list');
    const modelCount = ollamaModels
      ? ollamaModels.split('\n').filter(l => l.trim() && !l.startsWith('NAME')).length
      : 0;
    check(OK, 'Ollama', `${ollamaVersion} — ${modelCount} model(s) installed`);
    if (modelCount === 0) {
      check(WARN, '  Models', 'No models installed. Run: ollama pull llama3.2:3b');
    }
  } else {
    // Check if Ollama API is reachable even without CLI
    const ollamaApi = tryExec('curl -s http://localhost:11434/api/tags');
    if (ollamaApi) {
      try {
        const data = JSON.parse(ollamaApi);
        check(OK, 'Ollama', `API reachable — ${data.models?.length || 0} model(s)`);
      } catch {
        check(WARN, 'Ollama', 'API reachable but response unexpected');
      }
    } else {
      check(WARN, 'Ollama', 'not installed (optional — needed for local AI mode)');
      check(WARN, '  Install', 'https://ollama.com/download');
    }
  }

  // 5. Port 3000
  const port3000Free = await checkPort(3000);
  if (port3000Free) {
    check(OK, 'Port 3000', 'available');
  } else {
    check(WARN, 'Port 3000', 'in use — GigaClaw will auto-select another port');
  }

  // 6. .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const requiredVars = ['AUTH_SECRET', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'GIGACLAW_MODE'];
    const missing = requiredVars.filter(v => !new RegExp(`^${v}=.+`, 'm').test(envContent));
    if (missing.length === 0) {
      check(OK, '.env file', `found — all required vars set`);
    } else {
      check(WARN, '.env file', `found — missing: ${missing.join(', ')}`);
    }

    // Check API key
    const hasApiKey = /^ANTHROPIC_API_KEY=.+$/m.test(envContent)
      || /^OPENAI_API_KEY=.+$/m.test(envContent);
    const mode = envContent.match(/^GIGACLAW_MODE=(.*)$/m)?.[1]?.trim() || 'hybrid';
    if (mode === 'hybrid' && !hasApiKey) {
      check(WARN, '  API Key', 'hybrid mode but no cloud API key set');
    } else if (hasApiKey) {
      check(OK, '  API Key', 'cloud API key configured');
    } else {
      check(OK, '  API Key', `not needed (${mode} mode)`);
    }
  } else {
    check(WARN, '.env file', 'not found — run npx gigaclaw@latest to create one');
  }

  // 7. npm cache
  const cacheVerify = tryExec('npm cache verify 2>&1 | tail -1');
  if (cacheVerify && !cacheVerify.includes('error')) {
    check(OK, 'npm cache', 'healthy');
  } else {
    check(WARN, 'npm cache', 'may have issues — run: npm cache clean --force');
  }

  // Summary
  console.log('\n  ─────────────────────────────────────────\n');
  if (issues === 0) {
    console.log(`  ${OK}  Environment looks good!\n`);
  } else {
    console.log(`  ${FAIL}  ${issues} critical issue(s) found. Fix them before running gigaclaw.\n`);
  }
}
