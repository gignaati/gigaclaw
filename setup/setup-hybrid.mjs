import fs from 'fs';
import path from 'path';
import os from 'os';
import * as clack from '@clack/prompts';
import { PROVIDERS } from './lib/providers.mjs';
import { brand } from '../lib/brand.js';
import { loadEnvFile } from './lib/env.mjs';
import { updateEnvVariable } from './lib/auth.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = 'http://localhost:11434';

function handleCancel(value) {
  if (clack.isCancel(value)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }
  return value;
}

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

function detectRAMgb() {
  try {
    return Math.floor(os.totalmem() / (1024 ** 3));
  } catch {
    return 8;
  }
}

function recommendModel(ramGb) {
  if (ramGb >= 64) return { model: 'llama3.1:70b', reason: '64 GB+ RAM — full precision 70B' };
  if (ramGb >= 32) return { model: 'llama3.1:70b-q4_0', reason: '32 GB RAM — quantised 70B (Q4)' };
  if (ramGb >= 16) return { model: 'llama3.1:8b', reason: '16 GB RAM — 8B model' };
  return { model: 'llama3.2:3b', reason: '8 GB or less RAM — 3B model' };
}

function writeEnvVars(vars) {
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

// ─── Main wizard ─────────────────────────────────────────────────────────────

export async function run() {
  clack.intro('Hybrid Mode — Cloud + Local AI Setup Wizard');

  clack.note(
    [
      'Hybrid Mode gives you the best of both worlds:',
      '',
      '  Cloud Provider  — handles complex reasoning, coding, long-context tasks',
      '  Local Ollama    — handles simple queries, drafts, privacy-sensitive work',
      '',
      `${brand.name}'s primary model decides which provider to use per-task,`,
      'based on complexity, privacy needs, and provider availability.',
      '',
      'You need:',
      '  1. A cloud LLM API key (Anthropic, OpenAI, Google, or PragatiGPT)',
      '  2. Ollama running locally (or skip for cloud-only fallback)',
    ].join('\n'),
    'Hybrid Mode — How It Works'
  );

  const proceed = handleCancel(await clack.confirm({
    message: 'Continue with Hybrid Mode setup?',
    initialValue: true,
  }));

  if (!proceed) {
    clack.cancel('Setup cancelled. Run npm run setup to choose a different mode.');
    process.exit(0);
  }

  const TOTAL_STEPS = 6;
  let currentStep = 0;

  const env = loadEnvFile();
  if (env) {
    clack.log.info('Existing .env detected — previously configured values can be skipped.');
  }

  // ─── Step 1: Cloud Provider Selection ───────────────────────────────────

  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Cloud Provider (Primary)`);
  clack.log.info('The cloud provider handles complex tasks. Choose your primary cloud LLM.');

  const cloudProviders = Object.entries(PROVIDERS)
    .filter(([key]) => key !== 'ollama' && key !== 'custom')
    .map(([key, p]) => ({
      value: key,
      label: p.label,
      hint: key === 'anthropic' ? 'recommended — best for coding + reasoning' : '',
    }));

  const cloudProvider = handleCancel(await clack.select({
    message: 'Choose your cloud LLM provider:',
    options: cloudProviders,
  }));

  const providerInfo = PROVIDERS[cloudProvider];

  // Cloud API key
  let cloudApiKey = env?.[providerInfo.envKey];
  if (cloudApiKey) {
    clack.log.success(`${providerInfo.name} API key: ****${cloudApiKey.slice(-4)}`);
    const reconfig = handleCancel(await clack.confirm({
      message: 'Reconfigure API key?',
      initialValue: false,
    }));
    if (reconfig) cloudApiKey = null;
  }

  if (!cloudApiKey) {
    clack.log.info(`Get your API key at: ${providerInfo.keyPage}`);

    cloudApiKey = handleCancel(await clack.password({
      message: `Paste your ${providerInfo.name} API key:`,
      validate: (input) => {
        if (!input) return 'API key is required';
        if (providerInfo.keyPrefix && !input.startsWith(providerInfo.keyPrefix)) {
          return `Expected key starting with ${providerInfo.keyPrefix}`;
        }
      },
    }));
  }

  // Cloud model selection
  const cloudModels = providerInfo.models.map((m) => ({
    value: m.id,
    label: m.name,
    hint: m.default ? 'recommended' : '',
  }));

  const cloudModel = handleCancel(await clack.select({
    message: `Choose your ${providerInfo.name} model:`,
    options: cloudModels,
  }));

  clack.log.success(`Cloud: ${providerInfo.name} → ${cloudModel}`);

  // ─── Step 2: Local Provider (Ollama) ────────────────────────────────────

  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Local Provider (Ollama)`);

  let ollamaRunning = await checkOllamaRunning();
  let localModel = null;
  let ollamaEnabled = false;

  if (!ollamaRunning) {
    clack.log.warn('Ollama is not running on localhost:11434');

    const platform = process.platform;
    const installCmd =
      platform === 'darwin'
        ? 'brew install ollama  →  ollama serve'
        : platform === 'win32'
          ? 'https://ollama.com/download  →  ollama serve'
          : 'curl -fsSL https://ollama.com/install.sh | sh  →  ollama serve';

    clack.log.info(`Install and start Ollama:\n  ${installCmd}`);

    const retryOllama = handleCancel(await clack.confirm({
      message: 'Retry Ollama check? (start it in another terminal first)',
      initialValue: false,
    }));

    if (retryOllama) {
      const s = clack.spinner();
      s.start('Checking Ollama...');
      ollamaRunning = await checkOllamaRunning();
      s.stop(ollamaRunning ? 'Ollama is running' : 'Ollama not detected');
    }

    if (!ollamaRunning) {
      clack.log.info('Hybrid mode will work cloud-only for now. You can start Ollama later.');
      clack.log.info('${brand.name} automatically detects Ollama at runtime — no reconfiguration needed.');
    }
  }

  if (ollamaRunning) {
    clack.log.success('Ollama is running at localhost:11434');
    ollamaEnabled = true;

    const ramGb = detectRAMgb();
    const { model: recommendedModel, reason } = recommendModel(ramGb);
    clack.log.info(`Detected RAM: ${ramGb} GB → Recommended: ${recommendedModel} (${reason})`);

    const pulledModels = await listOllamaModels();

    if (pulledModels.length > 0) {
      clack.log.info(`${pulledModels.length} model(s) already pulled.`);

      localModel = handleCancel(await clack.select({
        message: 'Choose your local Ollama model:',
        options: [
          ...pulledModels.map((m) => ({
            value: m,
            label: m,
            hint: m === recommendedModel ? 'recommended for your RAM' : '',
          })),
          { value: '__custom__', label: 'Type a different model name' },
        ],
      }));

      if (localModel === '__custom__') {
        localModel = handleCancel(await clack.text({
          message: 'Enter model name (e.g. mistral:7b, qwen2.5:3b):',
          validate: (v) => (!v ? 'Model name is required' : undefined),
        }));
      }
    } else {
      clack.log.warn('No models pulled yet.');
      clack.log.info(`Pull the recommended model: ollama pull ${recommendedModel}`);

      localModel = handleCancel(await clack.text({
        message: `Local model (default: ${recommendedModel}):`,
        placeholder: recommendedModel,
      }));
      localModel = localModel || recommendedModel;
    }

    clack.log.success(`Local: Ollama → ${localModel}`);
  }

  // ─── Step 3: Task Routing Strategy ──────────────────────────────────────

  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Task Routing Strategy`);

  clack.log.info(
    `Choose how ${brand.name} decides between cloud and local for each task.`
  );

  const routingStrategy = handleCancel(await clack.select({
    message: 'Task routing strategy:',
    options: [
      {
        value: 'auto',
        label: 'Auto — Primary model classifies each task',
        hint: 'recommended — smart routing based on complexity',
      },
      {
        value: 'cost-optimized',
        label: 'Cost-Optimized — Prefer local, escalate to cloud when needed',
        hint: 'minimizes API costs, uses cloud for complex tasks only',
      },
      {
        value: 'quality-first',
        label: 'Quality-First — Prefer cloud, use local for simple/private tasks',
        hint: 'best output quality, uses local only for quick drafts',
      },
      {
        value: 'privacy-first',
        label: 'Privacy-First — Prefer local, cloud only with explicit opt-in',
        hint: 'maximum data privacy, cloud only when you approve',
      },
    ],
  }));

  clack.log.success(`Routing: ${routingStrategy}`);

  // ─── Step 4: Auth Secrets ───────────────────────────────────────────────

  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Auth Secrets`);

  const authSecret = env?.AUTH_SECRET || generateSecret(32);
  const nextAuthSecret = env?.NEXTAUTH_SECRET || generateSecret(32);

  clack.log.success('Auth secrets ready');

  // ─── Step 5: Write Configuration ────────────────────────────────────────

  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Writing Configuration`);

  const envVars = {
    GIGACLAW_MODE: 'hybrid',

    // Primary (cloud) provider — used for complex tasks and as default
    LLM_PROVIDER: cloudProvider,
    LLM_MODEL: cloudModel,
    [providerInfo.envKey]: cloudApiKey,

    // Local provider — used for simple tasks, drafts, privacy-sensitive work
    LOCAL_LLM_PROVIDER: ollamaEnabled ? 'ollama' : '',
    LOCAL_LLM_MODEL: localModel || '',
    OLLAMA_BASE_URL: 'http://localhost:11434',

    // Routing strategy
    HYBRID_ROUTING: routingStrategy,

    // Auth
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: nextAuthSecret,
    AUTH_SECRET: authSecret,
  };

  writeEnvVars(envVars);
  clack.log.success('.env written with hybrid configuration');

  // ─── Step 6: Summary & Start ────────────────────────────────────────────

  clack.log.step(`[${++currentStep}/${TOTAL_STEPS}] Setup Complete`);

  const summaryLines = [
    `Mode:           Hybrid (Cloud + Local)`,
    `Cloud Provider: ${providerInfo.label} → ${cloudModel}`,
    `Local Provider: ${ollamaEnabled ? `Ollama → ${localModel}` : 'Not configured (cloud-only fallback)'}`,
    `Routing:        ${routingStrategy}`,
    `App URL:        http://localhost:3000`,
    '',
    'How routing works:',
  ];

  switch (routingStrategy) {
    case 'auto':
      summaryLines.push('  The primary model analyzes each task and picks the best provider.');
      summaryLines.push('  Complex coding/reasoning → Cloud.  Quick queries/drafts → Local.');
      break;
    case 'cost-optimized':
      summaryLines.push('  All tasks start on Local. If the task is too complex or fails,');
      summaryLines.push('  ${brand.name} automatically escalates to Cloud.');
      break;
    case 'quality-first':
      summaryLines.push('  All tasks default to Cloud for best quality.');
      summaryLines.push('  Simple queries and privacy-sensitive tasks route to Local.');
      break;
    case 'privacy-first':
      summaryLines.push('  All tasks default to Local. Cloud is used only when you');
      summaryLines.push('  explicitly request it or the task requires cloud capabilities.');
      break;
  }

  summaryLines.push(
    '',
    'Start options:',
    '  npm run dev   — Next.js dev server (recommended)',
    '',
    ollamaEnabled
      ? 'Ollama is ready. Both providers are active.'
      : 'Start Ollama later — ${brand.name} detects it automatically at runtime.'
  );

  clack.note(summaryLines.join('\n'), 'Hybrid Mode Configuration');
  clack.outro('Chat with your agent at http://localhost:3000');
}

// Allow direct invocation
if (process.argv[1] && process.argv[1].endsWith('setup-hybrid.mjs')) {
  run().catch((error) => {
    clack.log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}
