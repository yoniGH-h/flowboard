import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DATABASE_URL } from '../playwright.config.js';

// מכין את המסד flowboard_e2e לפני שהשרת של הבדיקות עולה: מוחק ויוצר אותו מחדש,
// מריץ את ה-migrations של Prisma וטוען את נתוני הדמו (שכוללים את 4 התפקידים הקבועים
// שההרשמה צריכה). רץ מתוך backend-express כדי להשתמש ב-pg וב-Prisma של הפרויקט ההוא.
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
  // נתוני הדמו מדפיסים כל חשבון דמו; שומרים על פלט בדיקות קצר.
  execFileSync(process.execPath, ['prisma/seed.js'], { cwd: backendDir, env, stdio: ['ignore', 'ignore', 'inherit'] });
}
