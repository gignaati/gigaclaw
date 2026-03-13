#!/usr/bin/env node
/**
 * GigaBot Regression Test Suite
 *
 * Validates cross-platform install correctness:
 *   Tests  1-10  — TTY re-attachment (curl|bash), setup file syntax
 *   Tests 11-13  — Windows-safe AUTH_SECRET, shell:true, macOS PATH sourcing
 *   Tests 14-17  — install.ps1 PowerShell Windows installer
 *   Tests 18-20  — install.sh critical flow: npx --yes, npm install, GIGABOT_DIR
 *
 * NOTE: Tests 7 and 9 (physical /dev/tty access) are skipped on headless CI
 * runners (GitHub Actions, Docker without TTY) where /dev/tty is not attached
 * to a controlling terminal. The TTY guard *logic* is validated by Test 3
 * (source-level check) and Test 9 (conditional skip on CI).
 *
 * Run:  node scripts/test-tty-regression.mjs
 * CI:   npm run test:tty
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Detect headless CI environment (GitHub Actions, Docker, etc.)
const IS_CI = !!(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.JENKINS_URL ||
  process.env.TRAVIS ||
  process.env.CIRCLECI
);

let passed = 0;
let failed = 0;
let skipped = 0;

// Queue of { name, fn, opts } — collected synchronously, run in order via runAll()
const testQueue = [];

function test(name, fn, { skipOnCI = false } = {}) {
  testQueue.push({ name, fn, skipOnCI });
}

async function runAll() {
  for (const { name, fn, skipOnCI } of testQueue) {
    if (skipOnCI && IS_CI) {
      console.log(`  ⏭️  ${name} (skipped — headless CI)`);
      skipped++;
      continue;
    }
    try {
      // Support both sync and async test functions
      await fn();
      console.log(`  ✅  ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌  ${name}`);
      console.log(`      ${e.message}`);
      failed++;
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('\n🔍  GigaBot Regression Tests\n');
if (IS_CI) console.log('  ℹ️  Headless CI detected — /dev/tty physical-access tests will be skipped\n');

// ─── Test 1: install.sh has exec < /dev/tty guard ────────────────────────────
test('install.sh contains exec < /dev/tty guard', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('exec < /dev/tty'),
    'install.sh is missing the `exec < /dev/tty` TTY re-attachment line'
  );
});

// ─── Test 2: install.sh checks [ ! -t 0 ] before exec ───────────────────────
test('install.sh guards exec with [ ! -t 0 ] && [ -e /dev/tty ]', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('[ ! -t 0 ]') && installSh.includes('[ -e /dev/tty ]'),
    'install.sh is missing the conditional guard around exec < /dev/tty'
  );
});

// ─── Test 3: setup.mjs has Node.js TTY guard ─────────────────────────────────
test('setup.mjs contains Node.js-level TTY guard', () => {
  const setupMjs = fs.readFileSync(path.join(ROOT, 'setup', 'setup.mjs'), 'utf8');
  assert(
    setupMjs.includes('process.stdin.isTTY') && setupMjs.includes('/dev/tty'),
    'setup.mjs is missing the Node.js TTY guard block'
  );
});

// ─── Test 4: setup.mjs syntax is valid ───────────────────────────────────────
test('setup.mjs passes Node.js syntax check', () => {
  execSync(`node --check ${path.join(ROOT, 'setup', 'setup.mjs')}`, {
    stdio: 'pipe',
    shell: true,
  });
});

// ─── Test 5: setup-cloud.mjs syntax is valid ─────────────────────────────────
test('setup-cloud.mjs passes Node.js syntax check', () => {
  execSync(`node --check ${path.join(ROOT, 'setup', 'setup-cloud.mjs')}`, {
    stdio: 'pipe',
    shell: true,
  });
});

// ─── Test 6: setup-local.mjs syntax is valid ─────────────────────────────────
test('setup-local.mjs passes Node.js syntax check', () => {
  execSync(`node --check ${path.join(ROOT, 'setup', 'setup-local.mjs')}`, {
    stdio: 'pipe',
    shell: true,
  });
});

// ─── Test 7: /dev/tty is accessible (skipped on headless CI) ─────────────────
// GitHub Actions runners have /dev/tty but it returns ENXIO because there is
// no controlling terminal. This test is valid only on real interactive machines.
test('/dev/tty exists and is accessible', () => {
  assert(fs.existsSync('/dev/tty'), '/dev/tty does not exist on this system');
  let fd;
  try {
    fd = fs.openSync('/dev/tty', 'r+');
  } catch (e) {
    throw new Error(`Cannot open /dev/tty: ${e.message}`);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}, { skipOnCI: true });

// ─── Test 8: @clack/prompts can be imported ───────────────────────────────────
test('@clack/prompts can be imported', async () => {
  const { select, isCancel } = await import('@clack/prompts');
  assert(typeof select === 'function', 'select is not a function');
  assert(typeof isCancel === 'function', 'isCancel is not a function');
});

// ─── Test 9: Simulate curl|bash — stdin is non-TTY (skipped on headless CI) ──
// On headless CI /dev/tty itself is not accessible, so this test would always
// fail for the wrong reason. The TTY guard logic is validated by Test 3.
test('Simulated non-TTY stdin: TTY guard opens /dev/tty successfully', () => {
  const originalIsTTY = process.stdin.isTTY;
  try {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    let ttyOpened = false;
    if (!process.stdin.isTTY) {
      try {
        const ttyFd = fs.openSync('/dev/tty', 'r+');
        fs.closeSync(ttyFd);
        ttyOpened = true;
      } catch (_) {
        // /dev/tty not available
      }
    }
    assert(ttyOpened, '/dev/tty could not be opened under simulated non-TTY conditions');
  } finally {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  }
}, { skipOnCI: true });

// ─── Test 10: install.sh is executable ───────────────────────────────────────
test('install.sh is executable', () => {
  const stats = fs.statSync(path.join(ROOT, 'install.sh'));
  const isExecutable = !!(stats.mode & 0o111);
  assert(isExecutable, 'install.sh does not have executable permissions');
});

// ─── Summary (Tests 1-10) ─────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log(`${'─'.repeat(50)}\n`);

// ─── Test 11: AUTH_SECRET uses base64url (no +/= chars) ──────────────────────
test('bin/cli.js generates AUTH_SECRET with base64url (no +/= chars)', () => {
  const cliJs = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  assert(
    cliJs.includes('base64url'),
    'bin/cli.js is still using base64 for AUTH_SECRET — must use base64url to prevent Windows dotenv parsing failures'
  );
  const base64Matches = [...cliJs.matchAll(/randomBytes\([^)]+\)\.toString\(['"]base64['"]\)/g)];
  assert(
    base64Matches.length === 0,
    `Found ${base64Matches.length} plain base64 randomBytes call(s) — all must use base64url`
  );
});

// ─── Test 12: All execSync calls use shell:true ───────────────────────────────
test('bin/cli.js execSync calls for npm/git/docker use shell:true', () => {
  const cliJs = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  const execSyncCalls = [...cliJs.matchAll(/execSync\(['"`](?:npm|npx|git|docker)[^)]+\)/g)];
  const missingShell = execSyncCalls.filter(m => !m[0].includes('shell'));
  assert(
    missingShell.length === 0,
    `${missingShell.length} execSync call(s) missing shell:true — Windows cannot resolve .cmd shims without it:\n` +
    missingShell.map(m => `  ${m[0].slice(0, 80)}...`).join('\n')
  );
});

// ─── Test 13: install.sh sources Homebrew/nvm/asdf PATH ──────────────────────
test('install.sh sources Homebrew, nvm, and asdf for macOS/Linux PATH', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('/opt/homebrew/bin') || installSh.includes('homebrew'),
    'install.sh is missing Homebrew PATH sourcing (/opt/homebrew/bin) — required for macOS Apple Silicon'
  );
  assert(
    installSh.includes('.nvm/nvm.sh') || installSh.includes('NVM_DIR'),
    'install.sh is missing nvm sourcing (~/.nvm/nvm.sh) — required for nvm-managed Node.js installs'
  );
  assert(
    installSh.includes('.asdf/asdf.sh') || installSh.includes('asdf'),
    'install.sh is missing asdf sourcing (~/.asdf/asdf.sh) — required for asdf-managed Node.js installs'
  );
});

// ─── Test 14: install.ps1 exists ─────────────────────────────────────────────
test('install.ps1 exists in repo root', () => {
  const ps1Path = path.join(ROOT, 'install.ps1');
  assert(fs.existsSync(ps1Path), 'install.ps1 is missing from the repo root');
});

// ─── Test 15: install.ps1 has execution-policy self-bypass ───────────────────
test('install.ps1 contains execution policy self-bypass for irm|iex users', () => {
  const ps1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    ps1.includes('Set-ExecutionPolicy') && ps1.includes('Bypass') && ps1.includes('Process'),
    'install.ps1 is missing Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass — ' +
    'required so irm|iex works on machines with Restricted or AllSigned policy'
  );
});

// ─── Test 16: install.ps1 augments PATH for Windows Node.js managers ─────────
test('install.ps1 augments PATH for nvm-windows, fnm, Scoop, Chocolatey, Volta', () => {
  const ps1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  const required = [
    { token: 'nvm',         label: 'nvm-windows (%APPDATA%\\nvm)' },
    { token: 'fnm',         label: 'fnm (%LOCALAPPDATA%\\fnm)' },
    { token: 'chocolatey',  label: 'Chocolatey (C:\\ProgramData\\chocolatey\\bin)' },
    { token: 'scoop',       label: 'Scoop (%USERPROFILE%\\scoop\\shims)' },
    { token: 'Volta',       label: 'Volta (%LOCALAPPDATA%\\Volta\\bin)' },
  ];
  const missing = required.filter(r => !ps1.toLowerCase().includes(r.token.toLowerCase()));
  assert(
    missing.length === 0,
    'install.ps1 is missing PATH augmentation for: ' + missing.map(r => r.label).join(', ')
  );
});

// ─── Test 17: install.ps1 auto-launches setup wizard ─────────────────────────
test('install.ps1 auto-launches npm run setup after scaffolding', () => {
  const ps1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    ps1.includes('npm run setup'),
    'install.ps1 does not call npm run setup — users would have to run a second command manually'
  );
});

// ─── Test 18: install.sh uses npx --yes to suppress interactive prompt ────────
test('install.sh uses npx --yes to suppress "Ok to proceed?" prompt', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('npx --yes'),
    'install.sh is missing --yes on npx call — the "Ok to proceed? (y)" prompt will hang curl|bash installs'
  );
});

// ─── Test 19: install.sh runs npm install before npm run setup ───────────────
test('install.sh runs npm install before npm run setup', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  // Only match actual command lines, not comments (lines starting with #)
  const lines = installSh.split('\n');
  const installLine = lines.findIndex(l => !l.trimStart().startsWith('#') && /\bnpm install\b/.test(l));
  const setupLine   = lines.findIndex(l => !l.trimStart().startsWith('#') && /\bnpm run setup\b/.test(l));
  assert(
    installLine !== -1,
    'install.sh is missing npm install — setup wizard will fail with "Cannot find module" errors'
  );
  assert(
    setupLine !== -1,
    'install.sh is missing npm run setup'
  );
  assert(
    installLine < setupLine,
    `install.sh runs npm run setup (line ${setupLine + 1}) before npm install (line ${installLine + 1}) — dependencies will not be available`
  );
});

// ─── Test 20: bin/cli.js uses GitHub dep or current version (not ^1.0.0) ─────
test('bin/cli.js scaffolds package.json with current version, not hardcoded ^1.0.0', () => {
  const cliJs = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  assert(
    !cliJs.includes("'^1.0.0'") && !cliJs.includes('"^1.0.0"'),
    'bin/cli.js still hardcodes ^1.0.0 for gigabotDep — scaffolded projects will install the oldest version'
  );
});

// ─── Test 21: DropdownMenuItem destructures asChild (not spread to DOM) ─────────
test('DropdownMenuItem destructures asChild — not spread to DOM element', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'lib', 'chat', 'components', 'ui', 'dropdown-menu.jsx'),
    'utf8'
  );
  // The function signature must explicitly list asChild as a named parameter
  assert(
    /DropdownMenuItem\([^)]*asChild[^)]*\)/.test(src),
    'DropdownMenuItem does not destructure asChild from props — it will be spread onto the DOM <div> causing React warning'
  );
  // The ...props spread on the <div> must NOT include asChild (it was destructured out)
  // Verify the div render path does not have asChild in the spread
  const divBlock = src.slice(src.lastIndexOf('<div'), src.indexOf('</div>', src.lastIndexOf('<div>')));
  assert(
    !divBlock.includes('asChild'),
    'asChild is still being spread onto the DOM <div> in DropdownMenuItem — React will warn'
  );
});

// ─── Test 22: DropdownMenuItem.js (compiled) also destructures asChild ───────────────────
// NOTE: lib/chat/components/ui/*.js is gitignored — generated by `npm run build`
// (prepublishOnly). On CI this file only exists after the build step runs.
// Skip gracefully if the file is absent (pre-build environment).
test('DropdownMenuItem compiled .js also destructures asChild', () => {
  const compiledPath = path.join(ROOT, 'lib', 'chat', 'components', 'ui', 'dropdown-menu.js');
  if (!fs.existsSync(compiledPath)) {
    console.log('  ⏭️  DropdownMenuItem compiled .js also destructures asChild (skipped — compiled file absent, run npm run build first)');
    skipped++;
    return;
  }
  const compiled = fs.readFileSync(compiledPath, 'utf8');
  assert(
    /DropdownMenuItem\([^)]*asChild[^)]*\)/.test(compiled),
    'Compiled dropdown-menu.js DropdownMenuItem does not destructure asChild — .js and .jsx are out of sync'
  );
});

// ─── Test 23: templates/app/chat/[chatId]/page.js has no await params ─────────
test('templates/app/chat/[chatId]/page.js does not use await params (Next.js 15)', () => {
  const chatPage = fs.readFileSync(
    path.join(ROOT, 'templates', 'app', 'chat', '[chatId]', 'page.js'),
    'utf8'
  );
  assert(
    !chatPage.includes('await params'),
    'templates/app/chat/[chatId]/page.js still uses `await params` — Next.js 15 params are synchronous'
  );
  assert(
    chatPage.includes('const { chatId } = params'),
    'templates/app/chat/[chatId]/page.js is missing `const { chatId } = params` (synchronous destructure)'
  );
});

// ─── Test 24: templates/app/code/[codeWorkspaceId]/page.js has no await params
test('templates/app/code/[codeWorkspaceId]/page.js does not use await params (Next.js 15)', () => {
  const codePage = fs.readFileSync(
    path.join(ROOT, 'templates', 'app', 'code', '[codeWorkspaceId]', 'page.js'),
    'utf8'
  );
  assert(
    !codePage.includes('await params'),
    'templates/app/code/[codeWorkspaceId]/page.js still uses `await params` — Next.js 15 params are synchronous'
  );
  assert(
    codePage.includes('const { codeWorkspaceId } = params'),
    'templates/app/code/[codeWorkspaceId]/page.js is missing `const { codeWorkspaceId } = params`'
  );
});

// ─── Test 25: DropdownMenuTrigger does NOT render a <button> by default ──────────────
test('DropdownMenuTrigger renders <span role=button> not <button> by default', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'lib', 'chat', 'components', 'ui', 'dropdown-menu.jsx'),
    'utf8'
  );
  // The default (non-asChild) branch must use span, not button, to prevent
  // <button><button> nesting when callers pass a <button> child.
  const triggerFn = src.slice(src.indexOf('export function DropdownMenuTrigger'));
  const defaultBranch = triggerFn.slice(triggerFn.indexOf('role="button"'));
  assert(
    defaultBranch.length > 0 && defaultBranch.startsWith('role="button"'),
    'DropdownMenuTrigger default branch must use role="button" span, not <button>'
  );
  assert(
    !triggerFn.match(/<button[^>]*>(?!.*asChild)/s),
    'DropdownMenuTrigger must not render a raw <button> in the default (non-asChild) path'
  );
});

// ─── Test 26: compiled dropdown-menu.js also has the Slot pattern fix ─────────────
// NOTE: gitignored file — skip gracefully if absent (pre-build CI environment)
test('dropdown-menu.js compiled file uses span role=button in default trigger path', () => {
  const compiledPath = path.join(ROOT, 'lib', 'chat', 'components', 'ui', 'dropdown-menu.js');
  if (!fs.existsSync(compiledPath)) {
    console.log('  ⏭️  dropdown-menu.js compiled file uses span role=button (skipped — compiled file absent, run npm run build first)');
    skipped++;
    return;
  }
  const compiled = fs.readFileSync(compiledPath, 'utf8');
  assert(
    compiled.includes('role: "button"'),
    'dropdown-menu.js compiled file is missing role:"button" in DropdownMenuTrigger default path'
  );
  assert(
    compiled.includes('childIsInteractive'),
    'dropdown-menu.js compiled file is missing the childIsInteractive Slot pattern'
  );
});

// ─── Test 27: install.sh has GIGABOT_SKIP_SETUP=1 bypass ─────────────────────────
test('install.sh supports GIGABOT_SKIP_SETUP=1 bypass for CI/CD pipelines', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('GIGABOT_SKIP_SETUP'),
    'install.sh is missing the GIGABOT_SKIP_SETUP=1 bypass'
  );
  assert(
    installSh.includes('"${GIGABOT_SKIP_SETUP:-0}" = "1"'),
    'install.sh GIGABOT_SKIP_SETUP check must use ${GIGABOT_SKIP_SETUP:-0} with default value'
  );
});

// ─── Test 28: install.ps1 has GIGABOT_SKIP_SETUP=1 bypass ────────────────────────
test('install.ps1 supports GIGABOT_SKIP_SETUP=1 bypass for CI/CD pipelines', () => {
  const installPs1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    installPs1.includes('GIGABOT_SKIP_SETUP'),
    'install.ps1 is missing the GIGABOT_SKIP_SETUP bypass'
  );
  assert(
    installPs1.includes("$env:GIGABOT_SKIP_SETUP -eq '1'"),
    "install.ps1 GIGABOT_SKIP_SETUP check must use $env:GIGABOT_SKIP_SETUP -eq '1'"
  );
});

// ─── Test 29: CI workflow has explicit npm run build step before npm publish ─────────────
test('publish-npm.yml has explicit npm run build step before npm publish', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'publish-npm.yml'),
    'utf8'
  );
  // The build step must appear before the publish step in the publish-staging job
  const buildIdx = workflow.indexOf('npm run build');
  const publishIdx = workflow.indexOf('npm publish --tag staging');
  assert(
    buildIdx !== -1,
    'publish-npm.yml is missing an explicit `npm run build` step in publish-staging'
  );
  assert(
    buildIdx < publishIdx,
    '`npm run build` must appear before `npm publish --tag staging` in publish-npm.yml'
  );
});

// ─── Test 30: templates/public/favicon.ico exists for scaffolded projects ────────────
test('templates/public/favicon.ico exists to prevent 404 on every page load', () => {
  const faviconPath = path.join(ROOT, 'templates', 'public', 'favicon.ico');
  assert(
    fs.existsSync(faviconPath),
    'templates/public/favicon.ico is missing — scaffolded projects will get a 404 on every page load'
  );
  const stat = fs.statSync(faviconPath);
  assert(
    stat.size > 50,
    'templates/public/favicon.ico is too small to be a valid ICO file (expected > 50 bytes)'
  );
});

// ─── Run all tests and print final summary ───────────────────────────────────
runAll().then(() => {
  const total = passed + failed + skipped;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Final: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`${'─'.repeat(50)}\n`);
  if (failed > 0) process.exit(1);
}).catch((err) => {
  console.error('\n  ❌  Test runner crashed:', err.message);
  process.exit(1);
});
