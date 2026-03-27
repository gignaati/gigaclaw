// Platform Next.js config wrapper
// If you see ERR_MODULE_NOT_FOUND here, run: npm install
// then restart the dev server: npm run dev

let withGigaclaw;
try {
  ({ withGigaclaw } = await import('gigaclaw/config'));
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
    console.error('\n╔══════════════════════════════════════════════════════════════╗');
    console.error('║  Platform setup incomplete — dependencies not installed.      ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║  Fix: run the following commands in this directory, then     ║');
    console.error('║  restart the dev server.                                     ║');
    console.error('║                                                               ║');
    console.error('║    npm install                                                ║');
    console.error('║    npm run dev                                                ║');
    console.error('╚══════════════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }
  throw err;
}

export default withGigaclaw({});
