import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as clack from '@clack/prompts';
import { brand } from '../lib/brand.js';
import { loadEnvFile } from './lib/env.mjs';
import { updateEnvVariable } from './lib/auth.mjs';

// ─── Ollama helpers ───────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = 'http://localhost:11434';

async function checkOllamaRunning() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function listOllamaModels() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

// ─── Hardware detection ───────────────────────────────────────────────────────

function detectRAMgb() {
  try {
    const totalBytes = os.totalmem();
    return Math.floor(totalBytes / (1024 ** 3));
  } catch {
    return 8; // safe default
  }
}

function recommendModel(ramGb) {
  if (ramGb >= 64) return { model: 'llama3.1:70b',     reason: '64 GB+ RAM — full precision 70B' };
  if (ramGb >= 32) return { model: 'llama3.1:70b-q4_0', reason: '32 GB RAM — quantised 70B (Q4)' };
  if (ramGb >= 16) return { model: 'llama3.1:8b',       reason: '16 GB RAM — 8B model' };
  return               { model: 'llama3.2:3b',           reason: '8 GB or less RAM — 3B model' };
}

// ─── .env writer ─────────────────────────────────────────────────────────────

function writeLocalEnv(vars) {
  const envPath = path.join(process.cwd(), '.env');
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, content);
}

function generateSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export async function run() {
  clack.intro('Local Mode — Offline Setup Wizard');

  // ─── Caution banner ───────────────────────────────────────────────────────
  clack.note(
    [
      'What you are giving up in Local Mode:',
      '  ✗  Telegram bot integration (no internet = no Telegram webhooks)',
      '  ✗  GitHub-triggered jobs (no GitHub Actions runner)',
      '  ✗  ngrok tunnel (no public URL)',
      '  ✗  Automatic upgrades via GitHub Actions',
      '',
      'What still works perfectly:',
      '  ✓  Web chat interface at http://localhost:3000',
      '  ✓  Cron-scheduled jobs (internal scheduler)',
      '  ✓  Ollama LLM inference — any model you have pulled',
      '  ✓  File uploads and AI vision (multimodal models)',
      '  ✓  API key management',
      '  ✓  Persistent conversation history (SQLite)',
      '  ✓  Job queue and Swarm view',
      '  ✓  Push notifications via Ntfy (LAN only, optional)',
    ].join('\n'),
    'Local Mode — Capabilities'
  );

  const proceed = await clack.confirm({
    message: 'Continue with Local Mode setup?',
    initialValue: true,
  });

  if (clack.isCancel(proceed) || !proceed) {
    clack.cancel('Setup cancelled. Run npm run setup again to choose Cloud Mode.');
    process.exit(0);
  }

  const TOTAL_STEPS = 5;
  let currentStep = 0;

  const env = loadEnvFile();
  if (env) {
    clack.log.info('Existing .env detected — previously configured values can be skipped.');
  }

  // ─── Step 1: Check Ollama ─────────────────────────────────────────────────
  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Checking Ollama`);

  let ollamaRunning = await checkOllamaRunning();

  if (!ollamaRunning) {
    clack.log.warn('Ollama is not running on localhost:11434');

    const platform = process.platform;
    const installInstructions =
      platform === 'darwin'
        ? '  macOS:   brew install ollama  →  ollama serve'
        : platform === 'win32'
          ? '  Windows: https://ollama.com/download  →  ollama serve'
          : '  Linux:   curl -fsSL https://ollama.com/install.sh | sh  →  ollama serve';

    clack.log.info(
      'Install and start Ollama:\n\n' +
      installInstructions + '\n\n' +
      '  Then press Enter here to retry.'
    );

    // Retry loop
    let retries = 0;
    while (!ollamaRunning && retries < 3) {
      await clack.text({
        message: 'Press Enter once Ollama is running (or type "skip" to continue without it):',
      }).then(async (val) => {
        if (clack.isCancel(val)) { clack.cancel('Setup cancelled.'); process.exit(0); }
        if (val === 'skip') { ollamaRunning = 'skipped'; return; }
        const s = clack.spinner();
        s.start('Checking Ollama...');
        ollamaRunning = await checkOllamaRunning();
        s.stop(ollamaRunning ? 'Ollama is running' : 'Still not reachable');
      });
      retries++;
    }

    if (!ollamaRunning) {
      clack.log.warn('Ollama not detected. Continuing — you can start it later.');
    }
  } else {
    clack.log.success('Ollama is running at localhost:11434');
  }

  // ─── Step 2: Model selection ──────────────────────────────────────────────
  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] LLM Model Selection`);

  const ramGb = detectRAMgb();
  const { model: recommendedModel, reason } = recommendModel(ramGb);
  clack.log.info(`Detected RAM: ${ramGb} GB → Recommended model: ${recommendedModel} (${reason})`);

  let selectedModel = recommendedModel;

  if (ollamaRunning && ollamaRunning !== 'skipped') {
    const pulledModels = await listOllamaModels();

    if (pulledModels.length > 0) {
      clack.log.info(`You have ${pulledModels.length} model(s) already pulled.`);

      const modelChoice = await clack.select({
        message: 'Choose a model to use:',
        options: [
          ...pulledModels.map((m) => ({
            value: m,
            label: m,
            hint: m === recommendedModel ? '← recommended for your RAM' : '',
          })),
          { value: '__custom__', label: 'Type a different model name' },
        ],
      });

      if (clack.isCancel(modelChoice)) { clack.cancel('Setup cancelled.'); process.exit(0); }

      if (modelChoice === '__custom__') {
        const customModel = await clack.text({
          message: 'Enter model name (e.g. mistral:7b, qwen2.5:3b):',
          validate: (v) => (!v ? 'Model name is required' : undefined),
        });
        if (clack.isCancel(customModel)) { clack.cancel('Setup cancelled.'); process.exit(0); }
        selectedModel = customModel;
      } else {
        selectedModel = modelChoice;
      }
    } else {
      // No models pulled yet — show recommendation and pull command
      clack.log.warn('No models pulled yet.');
      clack.log.info(
        `Recommended for your hardware (${ramGb} GB RAM):\n\n` +
        `  ollama pull ${recommendedModel}\n\n` +
        'You can pull it now in another terminal, then press Enter to continue.\n' +
        'Or type a different model name below.'
      );

      const customModel = await clack.text({
        message: `Model to use (default: ${recommendedModel}):`,
        placeholder: recommendedModel,
      });
      if (clack.isCancel(customModel)) { clack.cancel('Setup cancelled.'); process.exit(0); }
      selectedModel = customModel || recommendedModel;
    }
  } else {
    // Ollama not running — use recommendation or let user type
    const customModel = await clack.text({
      message: `Model to use (default: ${recommendedModel}):`,
      placeholder: recommendedModel,
      initialValue: recommendedModel,
    });
    if (clack.isCancel(customModel)) { clack.cancel('Setup cancelled.'); process.exit(0); }
    selectedModel = customModel || recommendedModel;
  }

  clack.log.success(`Model selected: ${selectedModel}`);

  // ─── Step 3: Auth secrets ─────────────────────────────────────────────────
  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Generating Auth Secrets`);

  const authSecret = env?.AUTH_SECRET || generateSecret(32);
  const nextAuthSecret = env?.NEXTAUTH_SECRET || generateSecret(32);

  clack.log.success('Auth secrets ready');

  // ─── Step 4: Write .env ───────────────────────────────────────────────────
  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Writing Configuration`);

  const envVars = {
    GIGACLAW_MODE: 'local',
    LLM_PROVIDER: 'ollama',
    LLM_MODEL: selectedModel,
    OLLAMA_BASE_URL: 'http://localhost:11434',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: nextAuthSecret,
    AUTH_SECRET: authSecret,
  };

  writeLocalEnv(envVars);
  clack.log.success('.env written with local configuration');

  // ─── Step 5: Start server ─────────────────────────────────────────────────
  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] How to start ${brand.name}`);

  const composeFile = fs.existsSync(path.join(process.cwd(), 'docker-compose.local.yml'))
    ? 'docker-compose.local.yml'
    : 'docker-compose.yml';

  // Check if the server is already running
  let serverRunning = false;
  try {
    await fetch('http://localhost:3000/api/ping', { signal: AbortSignal.timeout(2000) });
    serverRunning = true;
  } catch { /* not running */ }

  if (serverRunning) {
    clack.log.success('${brand.name} is already running at http://localhost:${brand.localPort}');
  } else {
    // Check if Docker is available
    let dockerAvailable = false;
    try {
      execSync('docker info', { stdio: 'pipe' });
      dockerAvailable = true;
    } catch { /* Docker not running or not installed */ }

    // Ask user how they want to start
    const startMethod = await clack.select({
      message: `How would you like to start ${brand.name}?`,
      options: [
        {
          value: 'dev',
          label: 'npm run dev  (recommended — Next.js dev server, no Docker needed)',
          hint: 'fastest to start, hot-reload enabled',
        },
        {
          value: 'docker',
          label: `docker compose  (${dockerAvailable ? 'Docker detected ✓' : 'Docker not detected ✗ — install Docker first'})`,
          hint: dockerAvailable ? 'builds from local source, no registry login needed' : 'https://docs.docker.com/get-docker/',
        },
        {
          value: 'later',
          label: 'Start later — just show me the commands',
        },
      ],
    });

    if (clack.isCancel(startMethod) || startMethod === 'later') {
      clack.log.info(`No problem — start ${brand.name} when you are ready.`);
    } else if (startMethod === 'dev') {
      clack.log.info(`Starting ${brand.name} with npm run dev...`);
      clack.log.info('(Press Ctrl+C to stop the server)');
      clack.outro('Chat with your agent at http://localhost:3000');
      // exec npm run dev in the foreground so the user sees the output
      try {
        execSync('npm run dev', { stdio: 'inherit', cwd: process.cwd() });
      } catch {
        // User pressed Ctrl+C — normal exit, not an error
      }
      return;
    } else if (startMethod === 'docker') {
      if (!dockerAvailable) {
        clack.log.warn(
          'Docker is not running or not installed.\n' +
          '  Install Docker: https://docs.docker.com/get-docker/\n' +
          '  Then run: docker compose -f ' + composeFile + ' up -d'
        );
      } else {
        clack.log.info(`Building and starting ${brand.name} with Docker...\n  (First build takes ~2-3 minutes — subsequent starts are instant)`);
        try {
          execSync(`docker compose -f ${composeFile} up -d --build`, { stdio: 'inherit' });
          clack.log.success(`${brand.name} started via Docker`);
        } catch {
          clack.log.warn(
            'Docker start failed. Try the dev server instead:\n\n' +
            '  npm run dev\n'
          );
        }
      }
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  clack.note(
    [
      `Mode:       Local (offline)`,
      `LLM:        Ollama → ${selectedModel}`,
      `Ollama URL: http://localhost:11434`,
      `App URL:    http://localhost:3000`,
      `Database:   SQLite (local)`,
      '',
      'Start options:',
      '  npm run dev                                    — Next.js dev server (recommended)',
      `  docker compose -f ${composeFile} up -d --build  — Docker (builds from source)`,
      '',
      'To pull the selected model:',
      `  ollama pull ${selectedModel}`,
    ].join('\n'),
    'Local Mode Configuration'
  );

  clack.outro('Chat with your agent at http://localhost:3000');
}

// Allow direct invocation: node setup/setup-local.mjs
if (process.argv[1] && process.argv[1].endsWith('setup-local.mjs')) {
  run().catch((error) => {
    clack.log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}
