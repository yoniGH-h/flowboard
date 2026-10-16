# FlowBoard Frontend

This is the React app of FlowBoard (JavaScript, Vite, MUI, TanStack Query). It talks to the Express server in `../backend-express` through REST (the URL is in `VITE_API_URL`, the default is `http://localhost:3000/api`), and gets real-time notifications through Socket.IO.

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint         # code quality check
npm test             # unit tests (Vitest)
npm run test:e2e     # Playwright, starts its own server and database (flowboard_e2e)
npm run build        # production build
```

## Architecture

I tried to keep the same idea as on the server: every layer has one job, and a page never calls the server directly.

```
page / component  (src/features/*)
      │  uses a hook
      ▼
hooks             (src/lib/queries.js)      TanStack Query: cache, loading and error state,
      │  calls                              refreshing related data after a change
      ▼
API functions     (src/api/api.js)          one function per server route
      │  uses
      ▼
axios instance    (src/api/http.js)         base URL, adds the token, refreshes it on 401
      │
      ▼
Express server  (/api/*)
```

Some details:

- **Pages only use hooks.** For example the board page calls something like `useMoveTask()` and gets back `data`, `isPending` and `error`. It doesn't know about URLs or tokens.
- **Caching.** TanStack Query keeps the server data in a cache by a query key. After a change (a mutation) the hook invalidates the related keys, so the lists reload by themselves.
- **Login and tokens.** `auth/AuthContext.jsx` keeps the logged-in user. `api/session.js` stores the access token, and the refresh token is in an httpOnly cookie the browser sends by itself. When a request gets a 401, the interceptor in `api/http.js` asks the server for a new access token once and repeats the request. If that fails, the user is sent back to sign in.
- **Protected pages.** `auth/ProtectedRoute.jsx` wraps all the pages that need a logged-in user, and also checks the role for management pages (otherwise it shows the 403 page).
- **Permissions in the UI.** `lib/permissions.js` and the `can` / `canManage` fields the server returns decide which buttons to show. This is only for a nicer UI. The real checks happen on the server.
- **Real time.** `lib/socket.js` opens the Socket.IO connection with the token, and `lib/useNotificationsSocket.js` adds every new notification to the cache, so the bell updates without reloading the page.
- **Layout.** `layout/AppShell.jsx` is the frame around every page (sidebar, top bar, search, notification bell, user menu). The menu items come from `layout/navConfig.jsx` and depend on the user's active role.
- **Crashes.** `app/ErrorBoundary.jsx` catches errors in the UI so one broken component doesn't make the whole app go blank.

## Folder structure

| Folder | What's inside |
| --- | --- |
| `src/api` | The calls to the server (HTTP), adding the token to every request and refreshing it |
| `src/lib` | TanStack Query hooks, permission helpers, the Socket.IO connection, formatting helpers |
| `src/auth` | The logged-in user (session), protected routes, and the sign in / sign up pages |
| `src/features/*` | The screens, one folder per area (projects, kanban, tasks, dashboard, planning, admin...) |
| `src/components` | Shared components used in many screens |
| `src/layout` | The fixed frame: sidebar, top bar, navigation and role switcher |
| `src/app` | The QueryClient setup and the error boundary |
| `src/pages` | The 403 and 404 pages |
| `src/theme` | The MUI theme |

**Demo mode:** when `VITE_DEMO_MODE=true` (in `.env.development`), the sign-in page shows the demo accounts so you can log in with one click. They're not included in a production build.

To run the whole project, see the [main README](../README.md).
