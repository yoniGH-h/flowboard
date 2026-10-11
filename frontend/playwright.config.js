import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// מריץ את התרחיש המרכזי מול סביבה ייעודית וזמנית, כך שהוא אף פעם לא נוגע במסד
// הפיתוח: ה-API של Express (פורט 3001) משתמש במסד משלו, flowboard_e2e,
// ש-e2e/global-setup.js יוצר מחדש לפני כל הרצה, והאתר (פורט 5175) מופנה אל
// ה-API הזה דרך VITE_API_URL. שני הפורטים שונים מפורטי הפיתוח הרגילים (3000/5173), כך
// שאפשר להריץ את זה במקביל ל-npm run dev של המפתח.
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5175;
// ב-frontend/package.json מוגדר "type": "module", ולכן הקובץ הזה רץ כ-ESM - אין __dirname.
const dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(dirname, '../backend-express');

export const E2E_DATABASE_URL = 'postgresql://flowboard:flowboard@localhost:5433/flowboard_e2e';

const backendEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  PORT: String(BACKEND_PORT),
  CORS_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
  JWT_ACCESS_SECRET: 'e2e-test-access-secret',
  JWT_REFRESH_SECRET: 'e2e-test-refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  UPLOADS_DIR: './uploads-test',
  MAX_UPLOAD_SIZE_MB: '10',
  // כמה תרחישים רצים ברצף מאותה כתובת - לא נותנים למגבלת הקצב להפריע.
  RATE_LIMIT: 'off',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalSetup: path.resolve(dirname, './e2e/global-setup.js'),
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: backendDir,
      env: backendEnv,
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: dirname,
      env: { VITE_API_URL: `http://localhost:${BACKEND_PORT}/api` },
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
