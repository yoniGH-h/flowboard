# FlowBoard - frontend

The React app of FlowBoard (JavaScript, Vite, MUI, TanStack Query). It talks to the Express
API in `../backend-express` over REST (`VITE_API_URL`, default `http://localhost:3000/api`)
and receives real-time notifications over Socket.IO.

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint
npm test             # unit tests (Vitest)
npm run test:e2e     # Playwright - starts its own API and database (flowboard_e2e)
npm run build
```

Structure: `src/api` (HTTP calls), `src/lib` (query hooks, permissions, Socket.IO),
`src/auth` (session and sign-in pages), `src/features/*` (one folder per area),
`src/components` (shared UI), `src/layout` (app shell and navigation).

See the main [README](../README.md) for running the whole project.
