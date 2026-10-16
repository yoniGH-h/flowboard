# FlowBoard

FlowBoard is my final project. It's a web app for managing projects, teams and tasks inside a company, plus a "Decision Center" that helps managers decide what to do when a project starts falling behind.

I wanted to build more than a regular to-do board, so on top of the usual stuff (projects, a Kanban board, tasks, comments, files, notifications) it also tries to answer questions like:

- When will this project actually finish?
- Where does the work get stuck?
- How good is the team at estimating?
- Is the project at risk of being late, and why?
- If I move a task to someone else, will it help?

## Features

- **Several organizations in one system.** Every request is filtered on the server by the organization of the logged-in user, so one company never sees another company's data.
- **Four roles:** employee, project manager, organization admin and system admin. A project manager can only manage the projects they manage, not every project in the company.
- **Editable permissions.** The code checks permission keys (like `tasks.manage`), not role names. An org admin can change what each role can do, and give a specific user an extra permission or take one away (optionally until a date).
- **Projects and a Kanban board** with custom columns, a WIP limit that the server enforces, task dependencies, subtasks, comments and attachments.
- **Real-time notifications** with Socket.IO.
- **Voice / Zoom calls** between team members (optional, needs Zoom credentials).
- **Insights:** a forecast finish date, estimation accuracy, bottlenecks, and a risk score with its trend, all explained in simple sentences.
- **Decision Center:** recommendations, a "what if" simulator, and a decision log that checks later if a decision really helped.
- **Automation rules** ("when X happens, do Y") and an **audit log** for important actions.

## Tech stack

| Part | What I used |
|---|---|
| Frontend | React 19, Vite, React Router 7, MUI 7, TanStack Query 5, Axios, dnd-kit, Recharts, socket.io-client |
| Backend | Node.js, Express 5, Prisma 7, PostgreSQL 16, zod, JWT (access token + refresh token in an httpOnly cookie), bcrypt, helmet, express-rate-limit, multer, Socket.IO |
| Tests | Vitest + Testing Library, Playwright (with an automatic accessibility check), API tests for permissions and the Decision Center |

Everything is plain JavaScript (no TypeScript), so the server runs without a build step.

## Architecture

The system has three parts: the React app in the browser, the Express server, and the PostgreSQL database.

```
 Browser (React)                    Server (Express)                       Database
┌──────────────────┐  REST /api/*  ┌──────────────────────────────┐  Prisma  ┌────────────┐
│ pages            │ ────────────► │ middleware (auth, security)  │ ───────► │ PostgreSQL │
│ TanStack Query   │ ◄──────────── │ routes → services            │ ◄─────── │            │
│ axios (api/)     │               │                              │          └────────────┘
│                  │ ◄──────────── │ Socket.IO (notifications)    │
└──────────────────┘   WebSocket   └──────────────────────────────┘
```

How it works in short:

1. The user does something in a page (for example drags a task on the board).
2. The page calls a hook from `frontend/src/lib/queries.js`, the hook calls a function in `frontend/src/api/api.js`, and that sends an HTTP request with axios. The access token is added to every request automatically.
3. On the server the request goes through the global middleware (security headers, CORS, rate limit), then `requireAuth` checks the token.
4. The route file checks the input with zod and calls the service.
5. The service does the real work: permission checks, business rules, and the database queries through Prisma.
6. The server returns JSON. TanStack Query saves it in its cache and the page re-renders.
7. If other users need to know about the change, the server sends them a Socket.IO event, and their app reloads the data.

Each part has its own README with more details:

- [Backend README](backend-express/README.md): folder structure, request flow, permissions, insights, Decision Center
- [Frontend README](frontend/README.md): folder structure and how the data flows in the React app

## Folder structure

```
flowboard/
  frontend/          the React app
  backend-express/   the REST API + Socket.IO
  scripts/           database backup and restore, a check script for role levels
  backups/           where database backups are saved
  render.yaml        Render blueprint for hosting a demo online
  start-dev.ps1      starts PostgreSQL, the server and the site
  stop-dev.ps1       stops them
```

## Running it locally (Windows, no Docker)

You need Node.js 22 or newer, and a portable PostgreSQL 16 in `C:\flowboard-pg`.

```powershell
.\start-dev.ps1          # add -Seed to reload the demo data
.\stop-dev.ps1
```

`start-dev.ps1` starts PostgreSQL on port 5433, creates the `flowboard_express` database if it doesn't exist, runs the migrations, and then starts the server on `http://localhost:3000/api` and the site on `http://127.0.0.1:5173`.

If you want to run things by hand:

```bash
cd backend-express
cp .env.example .env
npm install
npm run prisma:migrate     # creates the tables
npm run prisma:seed        # demo data (this deletes the existing data!)
npm start

cd ../frontend
npm install
npm run dev
```

### Demo accounts

All demo accounts use the password `password123` (for local development only).

When `VITE_DEMO_MODE=true` (it's already set in `frontend/.env.development`), the sign-in page shows these accounts so you can log in with one click. That's handy when presenting the project. Set it to `false` to hide them. They are never included in a production build (`npm run build`).

| Email | Roles | Organization |
|---|---|---|
| ava.reynolds@nimbusdigital.io | employee, project manager, org admin, system admin | Nimbus Digital |
| daniel.cho@nimbusdigital.io | employee, project manager | Nimbus Digital |
| priya.sharma@nimbusdigital.io | employee | Nimbus Digital |
| marcus.webb@nimbusdigital.io | employee | Nimbus Digital |
| grace.kim@harborline.com | employee, project manager, org admin | Harborline Logistics |

## Tests

```bash
# frontend
cd frontend
npm run lint
npm test                     # unit tests (Vitest)
npm run test:e2e             # Playwright: a full scenario + accessibility, starts its own server and database

# backend (needs a running server with fresh demo data)
cd backend-express
npm run test:permissions     # permission tests
npm run test:planning        # recommendations, simulation and applying decisions
npm run test:transaction     # applying a decision is all-or-nothing (needs fresh demo data, not a running server)
```

## Backup and restore

```powershell
.\scripts\backup.ps1                                       # -> backups\flowboard-<date>.sql
.\scripts\restore.ps1 -BackupFile .\backups\flowboard-....sql
```

## Screens

- **Public:** sign in, sign up / join an organization, forgot password, reset password
- **Everyone:** my dashboard, my projects, project overview, Kanban board, my tasks, task details, notifications, profile and settings
- **Project manager:** management dashboard, project management, project team, team workload, Decision Center (recommendations, "what if" simulator, decision log), reports and insights
- **Org admin:** user management (including per-user permissions), roles and permissions, organization settings (including automation rules), audit log
- **System admin:** organizations and system management

There are also 403 and 404 pages, and an error boundary that catches crashes in the UI.

## Known limitations

These are things I know about and would fix in a real product:

- "Forgot password" returns the reset token in the server response instead of sending an email. I did this so the project runs locally without a mail service, but it means anyone who knows a user's email could reset their password. In a real system the token must only be sent by email.
- Attachments are saved on the server's local disk (`backend-express/uploads`). With more than one server they should go to cloud storage.
- Some state lives in the server's memory (rate limit counters, Socket.IO rooms, background timers). That's fine for one server, but running several servers would need Redis.
- Voice / Zoom calls need Zoom Server-to-Server OAuth credentials in `backend-express/.env`. Until they're set, the call buttons just explain that calls aren't configured.
