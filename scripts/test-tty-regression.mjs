#!/usr/bin/env node
/**
 * GigaClaw Regression Test Suite
 *
 * Validates cross-platform install correctness:
 *   Tests  1-10  — TTY re-attachment (curl|bash), setup file syntax
 *   Tests 11-13  — Windows-safe AUTH_SECRET, shell:true, macOS PATH sourcing
 *   Tests 14-17  — install.ps1 PowerShell Windows installer
 *   Tests 18-20  — install.sh critical flow: npx --yes, npm install, GIGACLAW_DIR
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

console.log('\n🔍  GigaClaw Regression Tests\n');
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
    installSh.includes('npx --yes gigaclaw@latest') || installSh.includes('npx -y gigaclaw@latest') ||
    installSh.includes('npx --yes gigaclaw@latest') || installSh.includes('npx -y gigaclaw@latest'),
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

// ─── Test 20: bin/cli.js uses current version for gigaclawDep (not ^1.0.0) ────
test('bin/cli.js scaffolds package.json with current version, not hardcoded ^1.0.0', () => {
  const cliJs = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  assert(
    !cliJs.includes("'^1.0.0'") && !cliJs.includes('"^1.0.0"'),
    'bin/cli.js still hardcodes ^1.0.0 for gigaclawDep — scaffolded projects will install the oldest version'
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

// ─── Test 27: install.sh has GIGACLAW_SKIP_SETUP=1 bypass ─────────────────────────
test('install.sh supports GIGACLAW_SKIP_SETUP=1 bypass for CI/CD pipelines', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('GIGACLAW_SKIP_SETUP') || installSh.includes('GIGACLAW_SKIP_SETUP'),
    'install.sh is missing the GIGACLAW_SKIP_SETUP=1 bypass'
  );
  assert(
    installSh.includes('"${GIGACLAW_SKIP_SETUP:-0}" = "1"') ||
    installSh.includes('"${GIGACLAW_SKIP_SETUP:-0}" = "1"'),
    'install.sh GIGACLAW_SKIP_SETUP check must use ${GIGACLAW_SKIP_SETUP:-0} with default value'
  );
});

// ─── Test 28: install.ps1 has GIGACLAW_SKIP_SETUP=1 bypass ────────────────────────
test('install.ps1 supports GIGACLAW_SKIP_SETUP=1 bypass for CI/CD pipelines', () => {
  const installPs1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    installPs1.includes('GIGACLAW_SKIP_SETUP') || installPs1.includes('GIGACLAW_SKIP_SETUP'),
    'install.ps1 is missing the GIGACLAW_SKIP_SETUP bypass'
  );
  assert(
    installPs1.includes("$env:GIGACLAW_SKIP_SETUP -eq '1'") ||
    installPs1.includes("$env:GIGACLAW_SKIP_SETUP -eq '1'"),
    "install.ps1 GIGACLAW_SKIP_SETUP check must use \$env:GIGACLAW_SKIP_SETUP -eq '1'"
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

// ─── Test 31: Gigaclaw rename — no stale gigabot references in package.json or README ───
test('Gigabot → Gigaclaw rename: package.json name is gigaclaw and README has no stale gigabot refs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(
    pkg.name === 'gigaclaw',
    `package.json name should be 'gigaclaw', got '${pkg.name}'`
  );
  assert(
    !pkg.description?.toLowerCase().includes('gigabot'),
    `package.json description still contains 'gigabot': ${pkg.description}`
  );
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const staleCount = (readme.match(/\bgigabot\b/gi) || []).length;
  assert(
    staleCount === 0,
    `README.md still contains ${staleCount} stale 'gigaclaw' reference(s)`
  );
});

// ─── Test 32: exportChat and exportAllChats actions exist in lib/chat/actions.js ───────
test('exportChat and exportAllChats are exported from lib/chat/actions.js with md/txt/json support', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'chat', 'actions.js'), 'utf8');
  assert(src.includes('async function exportChat'), 'exportChat function is missing from lib/chat/actions.js');
  assert(src.includes('async function exportAllChats'), 'exportAllChats function is missing from lib/chat/actions.js');
  assert(src.includes("'md'") || src.includes('"md"'), 'exportChat must handle md format');
  assert(src.includes("'txt'") || src.includes('"txt"'), 'exportChat must handle txt format');
  assert(src.includes("'json'") || src.includes('"json"'), 'exportChat must handle json format');
});

// ─── Test 33: ExportIcon exists in icons.jsx and compiled icons.js ───────────────────
test('ExportIcon is defined in icons.jsx and present in compiled icons.js', () => {
  const jsxSrc = fs.readFileSync(path.join(ROOT, 'lib', 'chat', 'components', 'icons.jsx'), 'utf8');
  assert(jsxSrc.includes('export function ExportIcon'), 'ExportIcon is missing from icons.jsx');
  const jsPath = path.join(ROOT, 'lib', 'chat', 'components', 'icons.js');
  if (fs.existsSync(jsPath)) {
    const compiled = fs.readFileSync(jsPath, 'utf8');
    assert(compiled.includes('ExportIcon'), 'ExportIcon missing from compiled icons.js — run npm run build');
  }
});

// ─── Test 34: DropdownMenuSub components exist in dropdown-menu.jsx and compiled .js ───
test('DropdownMenuSub/SubTrigger/SubContent defined in dropdown-menu.jsx and compiled .js', () => {
  const jsxSrc = fs.readFileSync(path.join(ROOT, 'lib', 'chat', 'components', 'ui', 'dropdown-menu.jsx'), 'utf8');
  assert(jsxSrc.includes('export function DropdownMenuSub('), 'DropdownMenuSub missing from dropdown-menu.jsx');
  assert(jsxSrc.includes('export function DropdownMenuSubTrigger('), 'DropdownMenuSubTrigger missing from dropdown-menu.jsx');
  assert(jsxSrc.includes('export function DropdownMenuSubContent('), 'DropdownMenuSubContent missing from dropdown-menu.jsx');
  const jsPath = path.join(ROOT, 'lib', 'chat', 'components', 'ui', 'dropdown-menu.js');
  if (fs.existsSync(jsPath)) {
    const compiled = fs.readFileSync(jsPath, 'utf8');
    assert(compiled.includes('DropdownMenuSub'), 'DropdownMenuSub missing from compiled dropdown-menu.js — run npm run build');
  }
});

// ─── Test 35: chat-header.jsx has Export submenu with all 3 format options ────────────
test('chat-header.jsx Export submenu contains md, txt, and json format options', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'chat', 'components', 'chat-header.jsx'), 'utf8');
  assert(src.includes('DropdownMenuSub'), 'chat-header.jsx is missing DropdownMenuSub for export');
  assert(src.includes("handleExport('md')"), 'chat-header.jsx is missing md export option');
  assert(src.includes("handleExport('txt')"), 'chat-header.jsx is missing txt export option');
  assert(src.includes("handleExport('json')"), 'chat-header.jsx is missing json export option');
});

// ─── Test 36: install.sh checks for Ollama and provides install guidance ────────────────────
test('install.sh checks for Ollama and shows install instructions', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('ollama') || installSh.includes('Ollama'),
    'install.sh is missing Ollama check — Local Mode users will not know they need Ollama'
  );
  assert(
    installSh.includes('https://ollama.com') || installSh.includes('ollama.com/install'),
    'install.sh is missing Ollama install URL — users need a link to install Ollama'
  );
  assert(
    installSh.includes('ollama serve'),
    'install.sh is missing `ollama serve` start command — users need to know how to start Ollama'
  );
});

// ─── Test 37: install.sh has retry loop for Ollama server not running ────────────────────
test('install.sh has retry loop when Ollama is installed but not running', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('localhost:11434') || installSh.includes('11434'),
    'install.sh is missing Ollama server check on localhost:11434'
  );
  assert(
    installSh.includes('retries') || installSh.includes('retry') || installSh.includes('press_enter_to_retry') || installSh.includes('Press Enter'),
    'install.sh is missing a retry loop for when Ollama is not running — users need guidance to start it'
  );
});

// ─── Test 38: install.sh mentions ngrok for Cloud Mode ───────────────────────────────────
test('install.sh mentions ngrok for Cloud Mode users', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  assert(
    installSh.includes('ngrok'),
    'install.sh is missing ngrok mention — Cloud Mode users will not know they need ngrok for tunnelling'
  );
  assert(
    installSh.includes('ngrok.com') || installSh.includes('ngrok.com/download'),
    'install.sh is missing ngrok download URL'
  );
});

// ─── Test 39: install.ps1 checks for Ollama and provides install guidance ────────────────
test('install.ps1 checks for Ollama and shows install instructions', () => {
  const ps1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    ps1.includes('ollama') || ps1.includes('Ollama'),
    'install.ps1 is missing Ollama check — Local Mode users will not know they need Ollama'
  );
  assert(
    ps1.includes('https://ollama.com') || ps1.includes('ollama.com/download'),
    'install.ps1 is missing Ollama install URL — users need a link to install Ollama'
  );
  assert(
    ps1.includes('ollama serve'),
    'install.ps1 is missing `ollama serve` start command — users need to know how to start Ollama'
  );
});

// ─── Test 40: install.ps1 has retry loop for Ollama server not running ───────────────────
test('install.ps1 has retry loop when Ollama is installed but not running', () => {
  const ps1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    ps1.includes('localhost:11434') || ps1.includes('11434'),
    'install.ps1 is missing Ollama server check on localhost:11434'
  );
  assert(
    ps1.includes('retries') || ps1.includes('retry') || ps1.includes('Read-Host') || ps1.includes('Press Enter'),
    'install.ps1 is missing a retry loop for when Ollama is not running — users need guidance to start it'
  );
});

// ─── Test 41: Both installers use Gigaclaw branding (not Giga Bot) ───────────────────────
test('Both installers use Gigaclaw branding — no stale Giga Bot references', () => {
  const installSh = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
  const installPs1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');

  // install.sh must have Gigaclaw in banner
  assert(
    installSh.includes('Gigaclaw'),
    'install.sh banner is missing Gigaclaw branding'
  );
  // install.sh must not have stale Giga Bot text
  const shStaleCount = (installSh.match(/Giga Bot/g) || []).length;
  assert(
    shStaleCount === 0,
    `install.sh still contains ${shStaleCount} stale 'Giga Bot' reference(s) — must be renamed to Gigaclaw`
  );

  // install.ps1 must have Gigaclaw in banner
  assert(
    installPs1.includes('Gigaclaw'),
    'install.ps1 banner is missing Gigaclaw branding'
  );
  // install.ps1 must not have stale Giga Bot text
  const ps1StaleCount = (installPs1.match(/Giga Bot/g) || []).length;
  assert(
    ps1StaleCount === 0,
    `install.ps1 still contains ${ps1StaleCount} stale 'Giga Bot' reference(s) — must be renamed to Gigaclaw`
  );
});

// ── Trust Ledger (v1.5.0) ──────────────────────────────────────────────────
test('Trust Ledger: audit_log table defined in schema.js', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'lib/db/schema.js'), 'utf8');
  assert(schema.includes("'audit_log'"), "schema.js must define the 'audit_log' table");
  assert(schema.includes('prev_hash'), 'audit_log must have prev_hash column for hash chain');
  assert(schema.includes('entry_hash'), 'audit_log must have entry_hash column');
});

test('Trust Ledger: migration 0004 SQL file exists', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'drizzle/0004_trust_ledger_audit_log.sql'), 'utf8');
  assert(sql.includes('CREATE TABLE'), 'migration must create audit_log table');
  assert(sql.includes('audit_log'), 'migration must reference audit_log');
});

test('Trust Ledger: audit-log.js exports logAction, getAuditLog, verifyAuditChain, getEgressSummary', () => {
  const mod = fs.readFileSync(path.join(ROOT, 'lib/db/audit-log.js'), 'utf8');
  assert(mod.includes('export function logAction'), 'must export logAction');
  assert(mod.includes('export function getAuditLog'), 'must export getAuditLog');
  assert(mod.includes('export function verifyAuditChain'), 'must export verifyAuditChain');
  assert(mod.includes('export function getEgressSummary'), 'must export getEgressSummary');
  assert(mod.includes('export function exportAuditLogJson'), 'must export exportAuditLogJson');
});

test('Trust Ledger: lib/ai/index.js instruments LLM calls with logAction', () => {
  const ai = fs.readFileSync(path.join(ROOT, 'lib/ai/index.js'), 'utf8');
  assert(ai.includes("import { logAction } from '../db/audit-log.js'"), 'ai/index.js must import logAction');
  assert(ai.includes("actionType: 'llm_call'"), 'ai/index.js must log llm_call actions');
  assert(ai.includes('tokens_in'), 'ai/index.js must log token counts');
  assert(ai.includes('is_local'), 'ai/index.js must log is_local flag');
});

test('Trust Ledger: TrustLedgerPage component exists with EgressPanel', () => {
  const page = fs.readFileSync(path.join(ROOT, 'lib/chat/components/trust-ledger-page.jsx'), 'utf8');
  assert(page.includes('TrustLedgerPage'), 'must export TrustLedgerPage');
  assert(page.includes('EgressPanel'), 'must include EgressPanel component');
  assert(page.includes('ChainBanner'), 'must include ChainBanner component');
  assert(page.includes('LogTable'), 'must include LogTable component');
});

test('Trust Ledger: trust-ledger route page exists in templates', () => {
  const route = fs.readFileSync(path.join(ROOT, 'templates/app/trust-ledger/page.js'), 'utf8');
  assert(route.includes('TrustLedgerPage'), 'route must render TrustLedgerPage');
  assert(route.includes("from 'gigaclaw/chat'"), 'route must import from gigaclaw/chat');
});

test('Trust Ledger: ShieldIcon and DownloadIcon defined in icons.jsx', () => {
  const icons = fs.readFileSync(path.join(ROOT, 'lib/chat/components/icons.jsx'), 'utf8');
  assert(icons.includes('export function ShieldIcon'), 'ShieldIcon must be defined');
  assert(icons.includes('export function DownloadIcon'), 'DownloadIcon must be defined');
});

test('Trust Ledger: AppSidebar includes Trust Ledger nav entry', () => {
  const sidebar = fs.readFileSync(path.join(ROOT, 'lib/chat/components/app-sidebar.jsx'), 'utf8');
  assert(sidebar.includes('/trust-ledger'), 'sidebar must link to /trust-ledger');
  assert(sidebar.includes('ShieldIcon'), 'sidebar must use ShieldIcon for Trust Ledger');
  assert(sidebar.includes('Trust Ledger'), 'sidebar must show Trust Ledger label');
});

test('Trust Ledger: package.json exports trust-ledger/actions', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.version >= '1.6.0', `version must be 1.6.0 or later, got ${pkg.version}`);
  assert(pkg.exports['./trust-ledger/actions'], 'must export ./trust-ledger/actions');
});

// ── v1.5.1: ERR_MODULE_NOT_FOUND fix (Node v24 + Windows) ────────────────────
test('v1.5.1: package.json exports use conditional objects (Node v24 compatible)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const exps = pkg.exports || {};
  assert(
    typeof exps['./config'] === 'object' && exps['./config'] !== null &&
    exps['./config']['import'] === './config/index.js',
    './config export must be a conditional object with import field'
  );
  assert(
    typeof exps['./auth'] === 'object' && exps['./auth'] !== null &&
    exps['./auth']['import'] === './lib/auth/index.js',
    './auth export must be a conditional object with import field'
  );
  assert(
    typeof exps['./chat/actions'] === 'object' && exps['./chat/actions'] !== null,
    './chat/actions export must be a conditional object'
  );
});

test('v1.5.1: next.config.mjs has defensive try/catch for ERR_MODULE_NOT_FOUND', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'templates/next.config.mjs'), 'utf8');
  assert(tpl.includes('try {'), 'next.config.mjs must have try block');
  assert(tpl.includes('ERR_MODULE_NOT_FOUND'), 'next.config.mjs must check ERR_MODULE_NOT_FOUND');
  assert(tpl.includes('npm install'), 'next.config.mjs must show npm install fix instruction');
  assert(tpl.includes('process.exit(1)'), 'next.config.mjs must exit on unrecoverable error');
});

test('v1.5.1: install.ps1 verifies node_modules/gigaclaw and retries on failure', () => {
  const ps1 = fs.readFileSync(path.join(ROOT, 'install.ps1'), 'utf8');
  assert(
    ps1.includes('GigaclawModulePath') && ps1.includes('node_modules'),
    'install.ps1 must verify node_modules/gigaclaw path after npm install'
  );
  assert(
    ps1.includes('--prefer-online'),
    'install.ps1 must retry npm install --prefer-online on missing package'
  );
});

// ─── v1.7.0: Brand Abstraction ─────────────────────────────────────────────
test('v1.7 config/brand.json exists with required fields', () => {
  const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brand.json'), 'utf8'));
  assert(brand.name, 'brand.json must have name field');
  assert(brand.tagline, 'brand.json must have tagline field');
  assert(brand.shortName, 'brand.json must have shortName field');
  assert(brand.supportEmail, 'brand.json must have supportEmail field');
});

test('v1.7 lib/brand.js exports brand accessor and imports brand.json', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/brand.js'), 'utf8');
  assert(src.includes('brand.json'), 'lib/brand.js must import from config/brand.json');
  assert(src.includes('export'), 'lib/brand.js must export brand fields or accessor');
});

test('v1.7 package.json exports ./brand module', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.exports['./brand'], 'package.json must export ./brand');
  assert(pkg.version === '1.8.1', `package.json version must be 1.8.1, got ${pkg.version}`);
});

// ─── v1.7.0: RAG Engine ──────────────────────────────────────────────────────
test('v1.7 lib/rag/chunker.js exports chunkDocument and estimateTokens with overlap', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/chunker.js'), 'utf8');
  assert(src.includes('export function chunkDocument'), 'chunker must export chunkDocument');
  assert(src.includes('export function estimateTokens'), 'chunker must export estimateTokens');
  assert(src.includes('overlapTokens'), 'chunker must support overlap');
});

test('v1.7 lib/rag/extractors.js supports PDF, DOCX, HTML with graceful fallback', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/extractors.js'), 'utf8');
  assert(src.includes('export async function extractFile'), 'extractors must export extractFile');
  assert(src.includes('export const SUPPORTED_EXTENSIONS'), 'extractors must export SUPPORTED_EXTENSIONS');
  assert(src.includes('.pdf') && src.includes('.docx') && src.includes('.html'), 'extractors must support PDF, DOCX, HTML');
  assert(src.includes('not installed') || src.includes('graceful'), 'extractors must have graceful fallback for optional deps');
});

test('v1.7 lib/rag/embeddings.js defaults to Ollama nomic-embed-text for local provider', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/embeddings.js'), 'utf8');
  assert(src.includes('export async function generateEmbeddings'), 'embeddings must export generateEmbeddings');
  assert(src.includes('export async function embedQuery'), 'embeddings must export embedQuery');
  assert(src.includes('nomic-embed-text'), 'embeddings must default to nomic-embed-text');
  assert(src.includes('localhost:11434') || src.includes('OLLAMA_BASE_URL'), 'embeddings must use Ollama for local');
});

test('v1.7 lib/rag/vector-store.js uses SQLite with cosine similarity', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/vector-store.js'), 'utf8');
  assert(src.includes('export function insertChunks'), 'vector-store must export insertChunks');
  assert(src.includes('export function searchVectors'), 'vector-store must export searchVectors');
  assert(src.includes('export function deleteSource'), 'vector-store must export deleteSource');
  assert(src.includes('cosineSimilarity'), 'vector-store must implement cosine similarity');
  assert(src.includes('better-sqlite3'), 'vector-store must use SQLite');
});

test('v1.7 lib/rag/hybrid-search.js implements BM25 + RRF fusion', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/hybrid-search.js'), 'utf8');
  assert(src.includes('export async function hybridSearch'), 'hybrid-search must export hybridSearch');
  assert(src.includes('Bm25') || src.includes('bm25') || src.includes('BM25'), 'hybrid-search must implement BM25');
  assert(src.includes('Fusion') || src.includes('fusion') || src.includes('RRF'), 'hybrid-search must implement RRF fusion');
});

test('v1.7 lib/rag/watcher.js exports startWatcher, stopWatcher, ingestFile', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/watcher.js'), 'utf8');
  assert(src.includes('export async function startWatcher'), 'watcher must export startWatcher');
  assert(src.includes('export function stopWatcher'), 'watcher must export stopWatcher');
  assert(src.includes('export async function ingestFile'), 'watcher must export ingestFile');
  assert(src.includes('gigaclaw-docs') || src.includes('RAG_DOCS_DIR'), 'watcher must use gigaclaw-docs as default dir');
});

test('v1.7 lib/rag/index.js exports ingest, search, deleteKnowledge, ragQuery, buildRagContext', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/rag/index.js'), 'utf8');
  assert(src.includes('export async function ingest'), 'rag/index must export ingest');
  assert(src.includes('export async function search'), 'rag/index must export search');
  assert(src.includes('export function deleteKnowledge'), 'rag/index must export deleteKnowledge');
  assert(src.includes('export async function ragQuery'), 'rag/index must export ragQuery');
  assert(src.includes('export function buildRagContext'), 'rag/index must export buildRagContext');
});

test('v1.7 package.json exports all RAG submodules', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const required = ['./rag', './rag/chunker', './rag/embeddings', './rag/vector-store', './rag/hybrid-search', './rag/watcher'];
  const missing = required.filter(k => !pkg.exports[k]);
  assert(missing.length === 0, `package.json missing exports: ${missing.join(', ')}`);
});

// ─── v1.7.0: Connector Framework ─────────────────────────────────────────────
test('v1.7 lib/connectors/base.js defines BaseConnector with full interface', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/connectors/base.js'), 'utf8');
  assert(src.includes('export class BaseConnector'), 'base must export BaseConnector');
  assert(src.includes('async connect()'), 'BaseConnector must define connect()');
  assert(src.includes('async listFiles('), 'BaseConnector must define listFiles()');
  assert(src.includes('async fetchFile('), 'BaseConnector must define fetchFile()');
  assert(src.includes('async sync('), 'BaseConnector must define sync()');
  assert(src.includes('async disconnect()'), 'BaseConnector must define disconnect()');
});

test('v1.7 lib/connectors/filesystem.js extends BaseConnector with gigaclaw-docs default', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/connectors/filesystem.js'), 'utf8');
  assert(src.includes('extends BaseConnector'), 'FilesystemConnector must extend BaseConnector');
  assert(src.includes('gigaclaw-docs') || src.includes('RAG_DOCS_DIR'), 'FilesystemConnector must default to gigaclaw-docs');
  assert(src.includes('async listFiles'), 'FilesystemConnector must implement listFiles');
  assert(src.includes('async fetchFile'), 'FilesystemConnector must implement fetchFile');
});

test('v1.7 lib/connectors/registry.js registers FilesystemConnector and exports createConnector', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/connectors/registry.js'), 'utf8');
  assert(src.includes('export function createConnector'), 'registry must export createConnector');
  assert(src.includes('export function listConnectors'), 'registry must export listConnectors');
  assert(src.includes('FilesystemConnector'), 'registry must register FilesystemConnector');
});

test('v1.7 package.json exports ./connectors and ./connectors/filesystem', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.exports['./connectors'], 'package.json must export ./connectors');
  assert(pkg.exports['./connectors/filesystem'], 'package.json must export ./connectors/filesystem');
});

// ─── v1.8.0 Knowledge Base UI Tests ────────────────────────────────────────
test('KB-01: knowledge-base-actions.js exists and exports required functions', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/knowledge-base-actions.js'), 'utf8');
  assert(src.includes('export async function listDocuments'), 'must export listDocuments');
  assert(src.includes('export async function uploadDocument'), 'must export uploadDocument');
  assert(src.includes('export async function deleteDocument'), 'must export deleteDocument');
  assert(src.includes('export async function reindexDocument'), 'must export reindexDocument');
  assert(src.includes('export async function ragChat'), 'must export ragChat');
  assert(src.includes('export async function getKnowledgeBaseStats'), 'must export getKnowledgeBaseStats');
});

test('KB-02: knowledge-base-actions.js has path traversal protection', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/knowledge-base-actions.js'), 'utf8');
  assert(src.includes('Path traversal rejected'), 'deleteDocument must reject path traversal');
  assert(src.includes('startsWith(docsDir)'), 'must check path is within docsDir');
});

test('KB-03: knowledge-base-page.jsx exports KnowledgeBasePage with all sub-components', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/knowledge-base-page.jsx'), 'utf8');
  assert(src.includes('export function KnowledgeBasePage'), 'must export KnowledgeBasePage');
  assert(src.includes('UploadZone'), 'must include UploadZone component');
  assert(src.includes('DocumentTable'), 'must include DocumentTable component');
  assert(src.includes('RagChatPanel'), 'must include RagChatPanel component');
  assert(src.includes('StatsBar'), 'must include StatsBar component');
});

test('KB-04: RagChatPanel renders source citations with relevance scores', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/knowledge-base-page.jsx'), 'utf8');
  assert(src.includes('msg.sources'), 'RagChatPanel must render source citations');
  assert(src.includes('SOURCES'), 'must show SOURCES label for citations');
  assert(src.includes('score'), 'must show relevance score for each source');
});

test('KB-05: UploadZone has drag-and-drop support and gigaclaw-docs reference', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/knowledge-base-page.jsx'), 'utf8');
  assert(src.includes('onDrop'), 'UploadZone must handle drop events');
  assert(src.includes('onDragOver'), 'UploadZone must handle dragover events');
  assert(src.includes('gigaclaw-docs'), 'must mention gigaclaw-docs directory');
});

test('KB-06: knowledge-base Next.js route exists and renders KnowledgeBasePage', () => {
  const routePath = path.join(ROOT, 'templates/app/knowledge-base/page.js');
  assert(fs.existsSync(routePath), 'templates/app/knowledge-base/page.js must exist');
  const src = fs.readFileSync(routePath, 'utf8');
  assert(src.includes('KnowledgeBasePage'), 'route must render KnowledgeBasePage');
  assert(src.includes('gigaclaw/auth'), 'route must import auth from gigaclaw/auth');
});

test('KB-07: app-sidebar.jsx has Knowledge Base nav entry with BookIcon', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/app-sidebar.jsx'), 'utf8');
  assert(src.includes('/knowledge-base'), 'sidebar must link to /knowledge-base');
  assert(src.includes('BookIcon'), 'sidebar must use BookIcon for Knowledge Base');
  assert(src.includes('Knowledge Base'), 'sidebar must show Knowledge Base label');
});

test('KB-08: icons.jsx exports BookIcon', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/icons.jsx'), 'utf8');
  assert(src.includes('export function BookIcon'), 'icons.jsx must export BookIcon');
});

test('KB-09: components/index.js exports KnowledgeBasePage', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/index.js'), 'utf8');
  assert(src.includes('KnowledgeBasePage'), 'components/index.js must export KnowledgeBasePage');
});

test('KB-10: package.json exports ./knowledge-base/actions, ./rag, ./connectors', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.exports['./knowledge-base/actions'], 'package.json must export ./knowledge-base/actions');
  assert(pkg.exports['./rag'], 'package.json must export ./rag');
  assert(pkg.exports['./connectors'], 'package.json must export ./connectors');
});

// ─── v1.8.1: Document Sharing Feature ──────────────────────────────────────

test('SHARE-01: drizzle migration 0005 creates share_tokens table', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'drizzle/0005_knowledge_base_share_tokens.sql'), 'utf8');
  assert(sql.includes('CREATE TABLE'), 'migration must create a table');
  assert(sql.includes('share_tokens'), 'migration must create share_tokens table');
  assert(sql.includes('expires_at'), 'share_tokens must have expires_at column');
  assert(sql.includes('revoked'), 'share_tokens must have revoked column');
  assert(sql.includes('access_count'), 'share_tokens must have access_count column');
  assert(sql.includes('permission'), 'share_tokens must have permission column');
});

test('SHARE-02: drizzle journal includes migration 0005', () => {
  const journal = JSON.parse(fs.readFileSync(path.join(ROOT, 'drizzle/meta/_journal.json'), 'utf8'));
  const tags = journal.entries.map(e => e.tag);
  assert(tags.includes('0005_knowledge_base_share_tokens'), 'journal must include migration 0005');
});

test('SHARE-03: db/schema.js defines shareTokens table', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/db/schema.js'), 'utf8');
  assert(src.includes('shareTokens'), 'schema.js must define shareTokens table');
  assert(src.includes('expires_at') || src.includes('expiresAt'), 'shareTokens must have expiry field');
  assert(src.includes('revoked'), 'shareTokens must have revoked field');
});

test('SHARE-04: share-actions.js exports all required functions', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/share-actions.js'), 'utf8');
  assert(src.includes('export async function createShareLink'), 'must export createShareLink');
  assert(src.includes('export async function listShareLinks'), 'must export listShareLinks');
  assert(src.includes('export async function revokeShareLink'), 'must export revokeShareLink');
  assert(src.includes('export async function getSharedDocument'), 'must export getSharedDocument');
  assert(src.includes('export async function getShareStats'), 'must export getShareStats');
});

test('SHARE-05: share-actions.js has path traversal protection', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/share-actions.js'), 'utf8');
  assert(src.includes('gigaclaw-docs'), 'must sandbox paths to ~/gigaclaw-docs/');
  assert(src.includes('Access denied'), 'must throw on path traversal attempt');
});

test('SHARE-06: share-actions.js validates token state (revoked/expired/exhausted)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/share-actions.js'), 'utf8');
  assert(src.includes('revoked'), 'must check revoked state');
  assert(src.includes('expires_at'), 'must check expiry');
  assert(src.includes('max_access'), 'must check access cap');
  assert(src.includes('access_count + 1'), 'must increment access count');
});

test('SHARE-07: share-dialog.jsx exports ShareButton and ShareDialog', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/share-dialog.jsx'), 'utf8');
  assert(src.includes('export function ShareDialog'), 'must export ShareDialog');
  assert(src.includes('export function ShareButton'), 'must export ShareButton');
});

test('SHARE-08: share-dialog.jsx has copy-to-clipboard, permission picker, expiry picker', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/share-dialog.jsx'), 'utf8');
  assert(src.includes('clipboard'), 'must have clipboard copy functionality');
  assert(src.includes('permission'), 'must have permission picker');
  assert(src.includes('expiresInDays'), 'must have expiry picker');
  assert(src.includes('maxAccess'), 'must have max access input');
  assert(src.includes('revokeShareLink'), 'must call revokeShareLink for revoke action');
});

test('SHARE-09: public share viewer page exists at templates/app/share/[token]/page.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'templates/app/share/[token]/page.js'), 'utf8');
  assert(src.includes('getSharedDocument'), 'viewer must call getSharedDocument');
  assert(src.includes('ErrorView'), 'viewer must have error state component');
  assert(src.includes('noindex'), 'viewer must set noindex robots meta');
  assert(src.includes('DocumentViewer'), 'viewer must have DocumentViewer component');
});

test('SHARE-10: package.json exports ./share-actions and ./share-dialog', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.exports['./share-actions'], 'package.json must export ./share-actions');
  assert(pkg.exports['./share-dialog'], 'package.json must export ./share-dialog');
});

test('SHARE-11: components/index.js exports ShareButton and ShareDialog', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/chat/components/index.js'), 'utf8');
  assert(src.includes('ShareButton'), 'components/index.js must export ShareButton');
  assert(src.includes('ShareDialog'), 'components/index.js must export ShareDialog');
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
