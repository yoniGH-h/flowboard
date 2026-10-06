import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DATABASE_URL } from '../playwright.config.js';

// Prepares the flowboard_e2e database before the API webServer boots: drops and re-creates it,
// applies the Prisma migrations and loads the demo data (which includes the 4 fixed roles that
// sign-up needs). Runs inside backend-express so it can use that project's pg / Prisma.
export default function globalSetup() {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const backendDir = path.resolve(dirname, '../../backend-express');
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };

  const recreate = `
    const { Client } = require('pg');
    (async () => {
      const client = new Client({ connectionString: 'postgresql://flowboard:flowboard@localhost:5433/postgres' });
      await client.connect();
      await client.query('DROP DATABASE IF EXISTS flowboard_e2e WITH (FORCE)');
      await client.query('CREATE DATABASE flowboard_e2e');
      await client.end();
    })().catch((e) => { console.error(e); process.exit(1); });`;
  execFileSync(process.execPath, ['-e', recreate], { cwd: backendDir, stdio: 'inherit' });

  const prismaCli = path.join(backendDir, 'node_modules/prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: backendDir, env, stdio: 'inherit' });
  // The seed prints every demo account; keep the test output short.
  execFileSync(process.execPath, ['prisma/seed.js'], { cwd: backendDir, env, stdio: ['ignore', 'ignore', 'inherit'] });
}
