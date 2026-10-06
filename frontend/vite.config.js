import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Without an explicit host, Vite binds to the "localhost" hostname, which on some
    // Windows setups resolves to IPv6-only (::1) - a browser that tries 127.0.0.1 first
    // (IPv4) then gets a connection refused / "Network Error" even though the server is
    // actually running. Binding to the IPv4 loopback explicitly avoids that.
    host: '127.0.0.1',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: true,
    // Playwright's own *.spec.js files live under e2e/ and use @playwright/test's test/expect,
    // not Vitest's - excluded here so Vitest doesn't try (and fail) to run them as unit tests.
    exclude: ['e2e/**', 'node_modules/**'],
    // The project path contains non-ASCII (Hebrew) characters and spaces. Vitest's default
    // worker pool communicates over an internal `fetch()`-based RPC that hangs for minutes
    // then times out against a path like that - `forks` (plain child_process.fork, no
    // fetch-based URL round-trip) sidesteps it entirely.
    pool: 'forks',
  },
});
