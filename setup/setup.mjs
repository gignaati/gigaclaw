#!/usr/bin/env node

import chalk from 'chalk';
import * as clack from '@clack/prompts';

const logo = `
   _______             ____        __ 
  / ____(_)___ _____ _/ __ )____  / /_
 / / __/ / __ \`/ __ \`/ __  / __ \\/ __/
/ /_/ / / /_/ / /_/ / /_/ / /_/ / /_  
\\____/_/\\__, /\\__,_/_____/\\____/\\__/  
        /____/                         
  India's Autonomous AI Agent · Powered by Gignaati
`;

async function main() {
  console.log(chalk.cyan(logo));

  clack.intro('GigaBot Setup Wizard');

  const mode = await clack.select({
    message: 'How do you want to run GigaBot?',
    options: [
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

  if (mode === 'cloud') {
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
