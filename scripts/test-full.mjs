#!/usr/bin/env node
/**
 * GigaClaw Full Application Test Suite
 *
 * Comprehensive automated test script covering:
 *   Section A  (Tests  1-12)  — Prerequisites & Environment
 *   Section B  (Tests 13-22)  — Package Structure & Exports
 *   Section C  (Tests 23-32)  — CLI Commands
 *   Section D  (Tests 33-42)  — Database & Schema
 *   Section E  (Tests 43-52)  — Authentication & Security
 *   Section F  (Tests 53-62)  — API Routes
 *   Section G  (Tests 63-72)  — Cron & Triggers
 *   Section H  (Tests 73-82)  — Setup Wizard (Cloud & Local)
 *   Section I  (Tests 83-92)  — Templates & Init Scaffolding
 *   Section J  (Tests 93-100) — Docker & GitHub Actions
 *
 * Run:  node scripts/test-full.mjs
 * CI:   npm run test:full
 * Env:  GIGACLAW_SKIP_SETUP=1  — skip tests that need a running server
 *       GIGACLAW_TEST_URL=...  — base URL for live server tests (default http://localhost:3000)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEST_URL = process.env.GIGACLAW_TEST_URL || 'http://localhost:3000';
const SKIP_LIVE = !!process.env.GIGACLAW_SKIP_SETUP;

const IS_CI = !!(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.JENKINS_URL ||
  process.env.TRAVIS ||
  process.env.CIRCLECI
);

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
const testQueue = [];
let currentSection = '';

function section(name) {
  testQueue.push({ type: 'section', name });
}

function test(name, fn, { skipOnCI = false, skipOnLive = false } = {}) {
  testQueue.push({ type: 'test', name, fn, skipOnCI, skipOnLive });
}

async function runAll() {
  for (const entry of testQueue) {
    if (entry.type === 'section') {
      currentSection = entry.name;
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`  ${entry.name}`);
      console.log(`${'═'.repeat(60)}`);
      continue;
    }

    const { name, fn, skipOnCI: skip_ci, skipOnLive } = entry;
    if (skip_ci && IS_CI) {
      console.log(`  ⏭️  ${name} (skipped — headless CI)`);
      skipped++;
      continue;
    }
    if (skipOnLive && SKIP_LIVE) {
      console.log(`  ⏭️  ${name} (skipped — GIGACLAW_SKIP_SETUP=1)`);
      skipped++;
      continue;
    }
    try {
      await fn();
      console.log(`  ✅  ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌  ${name}`);
      console.log(`      ${e.message}`);
      failed++;
      failures.push({ section: currentSection, name, error: e.message });
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFileExists(relPath) {
  const full = path.join(ROOT, relPath);
  assert(fs.existsSync(full), `Missing file: ${relPath}`);
}

function assertFileContains(relPath, needle, msg) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  assert(content.includes(needle), msg || `${relPath} does not contain "${needle}"`);
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function syntaxCheck(relPath) {
  execSync(`node --check "${path.join(ROOT, relPath)}"`, { stdio: 'pipe', shell: true });
}

// ─── Helper: check if command exists ──────────────────────────────────────────
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe', shell: true });
    return true;
  } catch { return false; }
}

// ─── Helper: try HTTP request ─────────────────────────────────────────────────
async function httpGet(urlPath) {
  const resp = await fetch(`${TEST_URL}${urlPath}`);
  return resp;
}

async function httpPost(urlPath, body = {}, headers = {}) {
  const resp = await fetch(`${TEST_URL}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return resp;
}

console.log('\n🔍  GigaClaw Full Application Test Suite\n');
console.log(`  Root:    ${ROOT}`);
console.log(`  CI:      ${IS_CI}`);
console.log(`  Live:    ${!SKIP_LIVE ? TEST_URL : 'skipped'}`);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A: Prerequisites & Environment
// ═══════════════════════════════════════════════════════════════════════════════

section('A — Prerequisites & Environment');

test('Node.js >= 18 is installed', () => {
  const [major] = process.versions.node.split('.').map(Number);
  assert(major >= 18, `Node.js ${major} found, need >= 18`);
});

test('npm is installed', () => {
  const out = execSync('npm --version', { stdio: 'pipe', shell: true }).toString().trim();
  assert(out.match(/^\d+\.\d+/), `Unexpected npm version: ${out}`);
});

test('git is installed', () => {
  assert(commandExists('git'), 'git is not installed');
});

test('package.json exists and has correct name', () => {
  const pkg = JSON.parse(readFile('package.json'));
  assert(pkg.name === 'gigaclaw', `Package name is "${pkg.name}", expected "gigaclaw"`);
});

test('package.json version is semver', () => {
  const pkg = JSON.parse(readFile('package.json'));
  assert(/^\d+\.\d+\.\d+/.test(pkg.version), `Invalid version: ${pkg.version}`);
});

test('package.json type is "module" (ESM)', () => {
  const pkg = JSON.parse(readFile('package.json'));
  assert(pkg.type === 'module', `Package type is "${pkg.type}", expected "module"`);
});

test('package.json has bin entry for gigaclaw', () => {
  const pkg = JSON.parse(readFile('package.json'));
  assert(pkg.bin && pkg.bin.gigaclaw, 'Missing bin.gigaclaw entry');
});

test('bin/cli.js exists and is executable', () => {
  assertFileExists('bin/cli.js');
  const stats = fs.statSync(path.join(ROOT, 'bin/cli.js'));
  const isExecutable = !!(stats.mode & 0o111);
  assert(isExecutable, 'bin/cli.js is not executable');
});

test('node_modules directory exists (deps installed)', () => {
  assert(fs.existsSync(path.join(ROOT, 'node_modules')), 'Run npm install first');
}, { skipOnCI: true });

test('drizzle-orm is installed', () => {
  assert(
    fs.existsSync(path.join(ROOT, 'node_modules/drizzle-orm')),
    'drizzle-orm not found in node_modules'
  );
}, { skipOnCI: true });

test('.env.example template exists', () => {
  assertFileExists('templates/.env.example');
});

test('No old "Giga Bot" or "gigabot" branding in key files', () => {
  const filesToCheck = [
    'package.json', 'README.md', 'api/index.js',
    'lib/actions.js', 'lib/cron.js', 'lib/triggers.js',
  ];
  for (const f of filesToCheck) {
    const content = readFile(f);
    assert(
      !content.includes('gigabot') && !content.includes('Giga Bot'),
      `Old branding found in ${f}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B: Package Structure & Exports
// ═══════════════════════════════════════════════════════════════════════════════

section('B — Package Structure & Exports');

test('All export entry points exist on disk', () => {
  const pkg = JSON.parse(readFile('package.json'));
  const exports = pkg.exports || {};
  for (const [key, val] of Object.entries(exports)) {
    if (key === './package.json') continue;
    const target = typeof val === 'string' ? val : val.import || val.default;
    assertFileExists(target);
  }
});

test('api/index.js exports GET and POST', () => {
  const content = readFile('api/index.js');
  assert(
    content.includes('export async function GET') || content.includes('export { GET'),
    'Missing GET export'
  );
  assert(
    content.includes('export async function POST') || content.includes('export { ') && content.includes('POST'),
    'Missing POST export'
  );
});

test('config/index.js exports withGigaclaw', () => {
  assertFileContains('config/index.js', 'withGigaclaw');
});

test('config/instrumentation.js exports register', () => {
  assertFileContains('config/instrumentation.js', 'register');
});

test('lib/auth/index.js exists', () => {
  assertFileExists('lib/auth/index.js');
});

test('lib/auth/middleware.js exists', () => {
  assertFileExists('lib/auth/middleware.js');
});

test('lib/chat/components/index.js exists', () => {
  assertFileExists('lib/chat/components/index.js');
});

test('lib/chat/actions.js exists and has "use server"', () => {
  assertFileExists('lib/chat/actions.js');
  assertFileContains('lib/chat/actions.js', 'use server');
});

test('lib/code/actions.js exists and has "use server"', () => {
  assertFileExists('lib/code/actions.js');
  assertFileContains('lib/code/actions.js', 'use server');
});

test('lib/db/index.js exists', () => {
  assertFileExists('lib/db/index.js');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C: CLI Commands
// ═══════════════════════════════════════════════════════════════════════════════

section('C — CLI Commands');

test('bin/cli.js passes syntax check', () => {
  syntaxCheck('bin/cli.js');
});

test('CLI supports init command', () => {
  assertFileContains('bin/cli.js', 'init');
});

test('CLI supports setup command', () => {
  assertFileContains('bin/cli.js', 'setup');
});

test('CLI supports reset-auth command', () => {
  assertFileContains('bin/cli.js', 'reset-auth');
});

test('CLI supports reset command', () => {
  assertFileContains('bin/cli.js', 'reset');
});

test('CLI supports diff command', () => {
  assertFileContains('bin/cli.js', 'diff');
});

test('CLI supports upgrade command', () => {
  assertFileContains('bin/cli.js', 'upgrade');
});

test('CLI supports set-agent-secret command', () => {
  assertFileContains('bin/cli.js', 'set-agent-secret');
});

test('CLI supports set-var command', () => {
  assertFileContains('bin/cli.js', 'set-var');
});

test('CLI uses base64url for AUTH_SECRET generation', () => {
  const content = readFile('bin/cli.js');
  assert(content.includes('base64url'), 'AUTH_SECRET must use base64url encoding');
  const plainBase64 = [...content.matchAll(/randomBytes\([^)]+\)\.toString\(['"]base64['"]\)/g)];
  assert(plainBase64.length === 0, `Found ${plainBase64.length} plain base64 call(s) — must use base64url`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D: Database & Schema
// ═══════════════════════════════════════════════════════════════════════════════

section('D — Database & Schema');

test('lib/db/schema.js passes syntax check', () => {
  syntaxCheck('lib/db/schema.js');
});

test('Schema defines users table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('users'");
});

test('Schema defines chats table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('chats'");
});

test('Schema defines messages table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('messages'");
});

test('Schema defines notifications table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('notifications'");
});

test('Schema defines subscriptions table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('subscriptions'");
});

test('Schema defines code_workspaces table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('code_workspaces'");
});

test('Schema defines audit_log table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('audit_log'");
});

test('Schema defines settings table', () => {
  assertFileContains('lib/db/schema.js', "sqliteTable('settings'");
});

test('Drizzle migration folder exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'drizzle')), 'drizzle/ directory missing');
});

test('drizzle.config.js exists', () => {
  assertFileExists('drizzle.config.js');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E: Authentication & Security
// ═══════════════════════════════════════════════════════════════════════════════

section('E — Authentication & Security');

test('lib/auth/actions.js has setupAdmin function', () => {
  assertFileContains('lib/auth/actions.js', 'setupAdmin');
});

test('API routes use timing-safe comparison', () => {
  assertFileContains('api/index.js', 'timingSafeEqual');
});

test('API key verification uses SHA-256 hashing', () => {
  assertFileContains('lib/db/api-keys.js', 'sha256', 'API key hashing should use SHA-256');
});

test('Public routes are defined (ping, webhooks)', () => {
  const content = readFile('api/index.js');
  assert(content.includes('/ping'), 'Missing /ping public route');
  assert(content.includes('/telegram/webhook'), 'Missing /telegram/webhook route');
  assert(content.includes('/github/webhook'), 'Missing /github/webhook route');
});

test('Server actions use requireAuth()', () => {
  assertFileContains('lib/chat/actions.js', 'requireAuth');
});

test('instrumentation.js validates AUTH_SECRET', () => {
  assertFileContains('config/instrumentation.js', 'AUTH_SECRET');
});

test('bcrypt is used for password hashing', () => {
  const content = readFile('lib/db/users.js');
  assert(content.includes('bcrypt') || content.includes('hashSync'), 'No password hashing found');
});

test('No hardcoded secrets in source code', () => {
  const files = ['api/index.js', 'lib/auth/index.js', 'config/instrumentation.js'];
  for (const f of files) {
    const content = readFile(f);
    // Check for common secret patterns (sk-, Bearer <token>, etc.)
    assert(
      !/sk-[a-zA-Z0-9]{20,}/.test(content),
      `Possible hardcoded API key found in ${f}`
    );
  }
});

test('Audit log module exists', () => {
  assertFileExists('lib/db/audit-log.js');
});

test('API key management module exists', () => {
  assertFileExists('lib/db/api-keys.js');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F: API Routes
// ═══════════════════════════════════════════════════════════════════════════════

section('F — API Routes');

test('api/index.js passes syntax check', () => {
  syntaxCheck('api/index.js');
});

test('/create-job route is defined', () => {
  assertFileContains('api/index.js', 'create-job');
});

test('/jobs/status route is defined', () => {
  assertFileContains('api/index.js', 'jobs/status');
});

test('/telegram/webhook route handles POST', () => {
  assertFileContains('api/index.js', 'telegram/webhook');
});

test('/github/webhook route validates secret', () => {
  const content = readFile('api/index.js');
  assert(
    content.includes('GH_WEBHOOK_SECRET') || content.includes('GITHUB_WEBHOOK_SECRET'),
    'GitHub webhook should validate secret'
  );
});

test('GET /ping returns health check', () => {
  assertFileContains('api/index.js', '/ping');
});

test('Trigger firing is integrated into POST handler', () => {
  assertFileContains('api/index.js', 'fireTriggers');
});

test('Job creation imports createJob', () => {
  assertFileContains('api/index.js', 'createJob');
});

test('Notification creation is available', () => {
  assertFileContains('api/index.js', 'createNotification');
});

test('Live: GET /api/ping returns 200', async () => {
  const resp = await httpGet('/api/ping');
  assert(resp.status === 200, `Expected 200, got ${resp.status}`);
}, { skipOnLive: true });

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION G: Cron & Triggers
// ═══════════════════════════════════════════════════════════════════════════════

section('G — Cron & Triggers');

test('lib/cron.js passes syntax check', () => {
  syntaxCheck('lib/cron.js');
});

test('lib/triggers.js passes syntax check', () => {
  syntaxCheck('lib/triggers.js');
});

test('lib/actions.js passes syntax check', () => {
  syntaxCheck('lib/actions.js');
});

test('Actions module handles agent type', () => {
  assertFileContains('lib/actions.js', 'agent');
});

test('Actions module handles command type', () => {
  assertFileContains('lib/actions.js', 'command');
});

test('Actions module handles webhook type', () => {
  assertFileContains('lib/actions.js', 'webhook');
});

test('Cron loads CRONS.json', () => {
  assertFileContains('lib/cron.js', 'CRONS.json');
});

test('Triggers load TRIGGERS.json', () => {
  assertFileContains('lib/triggers.js', 'TRIGGERS.json');
});

test('Template CRONS.json is valid JSON', () => {
  const content = readFile('templates/config/CRONS.json');
  JSON.parse(content); // throws on invalid JSON
});

test('Template TRIGGERS.json is valid JSON', () => {
  const content = readFile('templates/config/TRIGGERS.json');
  JSON.parse(content); // throws on invalid JSON
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION H: Setup Wizard (Cloud & Local)
// ═══════════════════════════════════════════════════════════════════════════════

section('H — Setup Wizard (Cloud & Local)');

test('setup/setup.mjs passes syntax check', () => {
  syntaxCheck('setup/setup.mjs');
});

test('setup/setup-cloud.mjs passes syntax check', () => {
  syntaxCheck('setup/setup-cloud.mjs');
});

test('setup/setup-local.mjs passes syntax check', () => {
  syntaxCheck('setup/setup-local.mjs');
});

test('setup.mjs has TTY guard', () => {
  const content = readFile('setup/setup.mjs');
  assert(
    content.includes('process.stdin.isTTY') && content.includes('/dev/tty'),
    'Missing TTY guard in setup.mjs'
  );
});

test('Cloud setup checks GitHub prerequisites', () => {
  const content = readFile('setup/setup-cloud.mjs');
  assert(content.includes('gh') || content.includes('github'), 'Cloud setup should check GitHub CLI');
});

test('Cloud setup handles LLM provider selection', () => {
  const content = readFile('setup/setup-cloud.mjs');
  assert(
    content.includes('anthropic') || content.includes('LLM_PROVIDER'),
    'Cloud setup should handle LLM provider'
  );
});

test('Local setup checks for Ollama', () => {
  const content = readFile('setup/setup-local.mjs');
  assert(content.includes('ollama') || content.includes('11434'), 'Local setup should check Ollama');
});

test('Local setup generates AUTH_SECRET', () => {
  const content = readFile('setup/setup-local.mjs');
  assert(content.includes('AUTH_SECRET'), 'Local setup should generate AUTH_SECRET');
});

test('Local setup writes .env file', () => {
  const content = readFile('setup/setup-local.mjs');
  assert(content.includes('.env'), 'Local setup should write .env');
});

test('Setup lib directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'setup/lib')), 'setup/lib/ directory missing');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION I: Templates & Init Scaffolding
// ═══════════════════════════════════════════════════════════════════════════════

section('I — Templates & Init Scaffolding');

test('templates/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'templates')), 'templates/ missing');
});

test('Template: .env.example exists', () => {
  assertFileExists('templates/.env.example');
});

test('Template: SOUL.md exists', () => {
  assertFileExists('templates/config/SOUL.md');
});

test('Template: CRONS.json exists', () => {
  assertFileExists('templates/config/CRONS.json');
});

test('Template: TRIGGERS.json exists', () => {
  assertFileExists('templates/config/TRIGGERS.json');
});

test('Template: app layout exists', () => {
  assertFileExists('templates/app/layout.js');
});

test('Template: middleware.js exists', () => {
  assertFileExists('templates/middleware.js');
});

test('Template: next.config.mjs exists', () => {
  assertFileExists('templates/next.config.mjs');
});

test('Template: event-handler Dockerfile exists', () => {
  assertFileExists('templates/docker/event-handler/Dockerfile');
});

test('Template: CLAUDE.md template uses GigaClaw branding', () => {
  const content = readFile('templates/CLAUDE.md.template');
  assert(!content.includes('Giga Bot'), 'CLAUDE.md.template still has old branding');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION J: Docker & GitHub Actions
// ═══════════════════════════════════════════════════════════════════════════════

section('J — Docker & GitHub Actions');

test('Event handler Dockerfile installs gigaclaw (not gigabot)', () => {
  const content = readFile('templates/docker/event-handler/Dockerfile');
  assert(!content.includes('gigabot'), 'Dockerfile still references gigabot');
  assert(content.includes('gigaclaw'), 'Dockerfile should reference gigaclaw');
});

test('Event handler Dockerfile uses Node 22', () => {
  assertFileContains('templates/docker/event-handler/Dockerfile', 'node:22');
});

test('Event handler Dockerfile exposes port', () => {
  assertFileContains('templates/docker/event-handler/Dockerfile', 'EXPOSE');
});

test('Claude Code job Dockerfile exists', () => {
  assertFileExists('templates/docker/claude-code-job/Dockerfile');
});

test('run-job.yml workflow exists', () => {
  assertFileExists('templates/.github/workflows/run-job.yml');
});

test('run-job.yml triggers on job/* branch', () => {
  assertFileContains('templates/.github/workflows/run-job.yml', 'job/');
});

test('publish-npm.yml workflow exists', () => {
  assertFileExists('.github/workflows/publish-npm.yml');
});

test('docker-compose template exists', () => {
  assertFileExists('templates/docker-compose.yml');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION K: AI & Chat
// ═══════════════════════════════════════════════════════════════════════════════

section('K — AI, Chat & Code Workspaces');

test('lib/ai/index.js exists', () => {
  assertFileExists('lib/ai/index.js');
});

test('lib/ai/agent.js exists', () => {
  assertFileExists('lib/ai/agent.js');
});

test('Chat function exports chat()', () => {
  assertFileContains('lib/ai/index.js', 'chat');
});

test('Agent uses LangGraph', () => {
  const content = readFile('lib/ai/agent.js');
  assert(
    content.includes('langgraph') || content.includes('LangGraph') || content.includes('@langchain'),
    'Agent should use LangGraph'
  );
});

test('lib/chat/api.js exists (streaming endpoint)', () => {
  assertFileExists('lib/chat/api.js');
});

test('Chat actions: getChats exists', () => {
  assertFileContains('lib/chat/actions.js', 'getChats');
});

test('Chat actions: createChat exists', () => {
  assertFileContains('lib/chat/actions.js', 'createChat');
});

test('Chat actions: deleteChat exists', () => {
  assertFileContains('lib/chat/actions.js', 'deleteChat');
});

test('Code workspace actions exist', () => {
  assertFileContains('lib/code/actions.js', 'createCodeWorkspace');
  assertFileContains('lib/code/actions.js', 'deleteCodeWorkspace');
});

test('WebSocket proxy exists for terminals', () => {
  assertFileExists('lib/code/ws-proxy.js');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION L: Channels & Integrations
// ═══════════════════════════════════════════════════════════════════════════════

section('L — Channels & Integrations');

test('Channel base class exists', () => {
  assertFileExists('lib/channels/base.js');
});

test('Telegram adapter exists', () => {
  const files = fs.readdirSync(path.join(ROOT, 'lib/channels'));
  assert(
    files.some(f => f.includes('telegram')),
    'No Telegram channel adapter found'
  );
});

test('Channel factory/index exists', () => {
  assertFileExists('lib/channels/index.js');
});

test('Telegram tools module exists', () => {
  assertFileExists('lib/tools/telegram.js');
});

test('GitHub tools module exists', () => {
  assertFileExists('lib/tools/github.js');
});

test('Job creation tool exists', () => {
  assertFileExists('lib/tools/create-job.js');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION M: Utilities & Markdown
// ═══════════════════════════════════════════════════════════════════════════════

section('M — Utilities & Cross-Cutting');

test('Markdown renderer exists', () => {
  assertFileExists('lib/utils/render-md.js');
});

test('Markdown renderer supports {{datetime}}', () => {
  assertFileContains('lib/utils/render-md.js', 'datetime');
});

test('Markdown renderer supports {{skills}}', () => {
  assertFileContains('lib/utils/render-md.js', 'skills');
});

test('Path resolver exists', () => {
  assertFileExists('lib/paths.js');
});

test('Path resolver uses process.cwd()', () => {
  assertFileContains('lib/paths.js', 'process.cwd()');
});

test('install.sh exists and is executable', () => {
  assertFileExists('install.sh');
  const stats = fs.statSync(path.join(ROOT, 'install.sh'));
  assert(!!(stats.mode & 0o111), 'install.sh is not executable');
});

test('install.ps1 exists for Windows', () => {
  assertFileExists('install.ps1');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Run everything
// ═══════════════════════════════════════════════════════════════════════════════

await runAll();

// ─── Final Summary ────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log(`  TOTAL:   ${passed + failed + skipped} tests`);
console.log(`${'═'.repeat(60)}`);

if (failures.length > 0) {
  console.log('\n  FAILURES:\n');
  for (const f of failures) {
    console.log(`  [${f.section}] ${f.name}`);
    console.log(`    → ${f.error}\n`);
  }
}

process.exit(failed > 0 ? 1 : 0);
