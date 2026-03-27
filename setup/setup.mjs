#!/usr/bin/env node

/**
 * TTY Guard — second line of defence against curl|bash stdin hijacking.
 *
 * When `npm run setup` is invoked from a script whose stdin is a pipe
 * (e.g. curl | bash), process.stdin.isTTY is undefined and @clack/prompts
 * exits immediately on the first keypress event (which is EOF).
 *
 * If /dev/tty is accessible we re-open it and reassign process.stdin so
 * that @clack/prompts gets a real terminal regardless of how this script
 * was launched. The primary fix lives in install.sh (exec < /dev/tty),
 * but this guard handles cases where setup.mjs is called directly without
 * going through install.sh.
 */
import fs from 'fs';
import { Readable } from 'stream';

if (!process.stdin.isTTY) {
  try {
    const ttyFd = fs.openSync('/dev/tty', 'r+');
    const ttyStream = new fs.ReadStream(null, { fd: ttyFd, autoClose: true });
    // Monkey-patch the TTY flag so @clack/prompts enables raw mode
    ttyStream.isTTY = true;
    ttyStream.setRawMode = (mode) => {
      try { fs.fstatSync(ttyFd); require('tty').ReadStream.prototype.setRawMode.call(ttyStream, mode); } catch (_) {}
    };
    process.stdin = ttyStream;
  } catch (_) {
    // /dev/tty not available (CI, Docker without TTY, etc.) — fall through;
    // the prompts will still render but keyboard input may not work.
    // In that case the user should run `npm run setup` directly in a terminal.
  }
}

import chalk from 'chalk';
import * as clack from '@clack/prompts';
import { brand } from '../lib/brand.js';

const logo = `
   _______             ________
  / ____(_)___ _____ _/ ____/ /___ _      __
 / / __/ / __ \`/ __ \`/ /   / / __ \\ | /| / /
/ /_/ / / /_/ / /_/ / /___/ / /_/ / |/ |/ /
\\____/_/\\__, /\\__,_/\\____/_/\\____/|__/|__/
       /____/
  ${brand.taglineFull}
`;

async function main() {
  console.log(chalk.cyan(logo));

  clack.intro(`${brand.name} Setup Wizard`);

  const mode = await clack.select({
    message: `How do you want to run ${brand.name}?`,
    options: [
      {
        value: 'hybrid',
        label: 'Hybrid Mode',
        hint: 'Cloud + Local AI — smart routing, best of both worlds (recommended)',
      },
      {
        value: 'cloud',
        label: 'Cloud Mode',
        hint: 'GitHub + ngrok + Telegram — full features, internet required',
      },
      {
        value: 'local',
        label: 'Local Mode',
        hint: 'Ollama only — 100% offline, no Telegram or GitHub needed',
      },
    ],
  });

  if (clack.isCancel(mode)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  if (mode === 'hybrid') {
    const { run } = await import('./setup-hybrid.mjs');
    await run();
  } else if (mode === 'cloud') {
    const { run } = await import('./setup-cloud.mjs');
    await run();
  } else {
    const { run } = await import('./setup-local.mjs');
    await run();
  }
}

main().catch((error) => {
  clack.log.error(`Setup failed: ${error.message}`);
  process.exit(1);
});
