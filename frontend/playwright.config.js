import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the golden path against a dedicated, disposable stack so it never touches the dev
// database: the Express API (port 3001) uses its own database, flowboard_e2e, which
// e2e/global-setup.js re-creates before every run, and the frontend (port 5175) is pointed at
// that API via VITE_API_URL. Both ports are distinct from the normal dev ports (3000/5173) so
// this can run alongside a developer's own `npm run dev`.
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5175;
// frontend/package.json has "type": "module", so this file runs as ESM - no __dirname.
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
