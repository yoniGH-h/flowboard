# FlowBoard

A project-management platform for organizations, projects, teams and tasks, with a decision
center for managers.

FlowBoard brings projects, a Kanban board, tasks, files, comments, real-time notifications,
permissions and an audit log into one place - and adds a management layer that draws
conclusions from that data: a delivery forecast for every project, where work gets stuck, how
accurate estimates are, an explainable delay-risk score and its trend, recommendations, a
"what-if" simulator, and a decision log that measures whether decisions actually helped.

## Features

- **Multi-tenant organizations** - every request is filtered by the caller's organization on the
  server.
- **Four roles** - Employee → Project Manager → Organization Admin → System Admin. A Project
  Manager controls only the projects they manage.
- **Dynamic permissions** - every check uses a permission key. An Org Admin can change what each
  role may do, and give a single employee an allow/deny exception, optionally until a date.
- **Projects and Kanban** - configurable columns, server-enforced WIP limits, task dependencies,
  subtasks, comments and file attachments.
- **Real-time notifications** over Socket.IO, and voice / Zoom calls between team members
  (optional, needs Zoom credentials).
- **Insights** - delivery forecast, estimate accuracy, bottlenecks, delay-risk score and trend,
  explained in plain language.
- **Decision Center** - recommendations, a what-if simulator and a decision log
  (then → predicted → now).
- **Automation rules** ("when X, do Y") and an **audit log** of every important action.

## Tech stack

**Frontend:** React 19 (JavaScript) + Vite, React Router 7, MUI 7, TanStack Query 5, Axios,
dnd-kit, Recharts, socket.io-client.

**Backend:** Node.js + Express 5 (JavaScript), Prisma 7 + PostgreSQL 16, zod, JWT
(access + rotating refresh token in an httpOnly cookie), bcrypt, helmet, express-rate-limit,
multer, Socket.IO.

**Tests:** Vitest + Testing Library, Playwright (including an automated WCAG scan), and
API smoke tests for permissions and planning.

## Repository layout

```
flowboard/
  frontend/          React app (27 screens)
  backend-express/   REST API + Socket.IO (see backend-express/README.md)
  scripts/           database backup / restore, role-level check
  docs/              use cases, accessibility, user guide (Hebrew)
  start-dev.ps1      starts PostgreSQL, the API and the frontend
  stop-dev.ps1       stops them
```

## Running locally (Windows, no Docker)

Prerequisites: Node.js 22+, and the portable PostgreSQL 16 in `C:\flowboard-pg`.

```powershell
.\start-dev.ps1          # add -Seed to reload the demo data
.\stop-dev.ps1
```

`start-dev.ps1` starts PostgreSQL on port 5433, creates the `flowboard_express` database if
needed, applies the migrations, starts the API on `http://localhost:3000/api` and the frontend
on `http://127.0.0.1:5173`.

Manually:

```bash
cd backend-express
cp .env.example .env
npm install
npm run prisma:migrate     # create the tables
npm run prisma:seed        # demo data (wipes existing data!)
npm start

cd ../frontend
npm install
npm run dev
```

### Demo accounts

Password for every demo account: `password123` (local development only).

**Demo mode** - with `VITE_DEMO_MODE=true` (already set in `frontend/.env.development`) the
sign-in page lists these accounts for one-click sign-in, which is handy when presenting the
system. Set it to `false` to hide them. A production build (`npm run build`) never includes
them.

| Email | Roles | Organization |
|---|---|---|
| ava.reynolds@nimbusdigital.io | Employee, Project Manager, Org Admin, System Admin | Nimbus Digital |
| daniel.cho@nimbusdigital.io | Employee, Project Manager | Nimbus Digital |
| priya.sharma@nimbusdigital.io | Employee | Nimbus Digital |
| marcus.webb@nimbusdigital.io | Employee | Nimbus Digital |
| grace.kim@harborline.com | Employee, Project Manager, Org Admin | Harborline Logistics |

## Tests

```bash
# frontend
cd frontend
npm run lint
npm test                     # unit tests (Vitest)
npm run test:e2e             # Playwright: golden path + accessibility, on its own API and database

# backend - against a running, freshly seeded API
cd backend-express
npm run test:permissions     # 34 permission checks
npm run test:planning        # recommendations / simulation / decisions
```

## Backup and restore

```powershell
.\scripts\backup.ps1                                       # -> backups\flowboard-<date>.sql
.\scripts\restore.ps1 -BackupFile .\backups\flowboard-....sql
```

## Screens

**Public:** Sign In · Sign Up / Join Organization · Forgot Password · Reset Password

**All roles:** Personal Dashboard · My Projects · Project Overview · Kanban Board · My Tasks ·
Task Details · Notification Center · Profile & Settings

**Project Manager:** Management Dashboard · Project Management · Project Team · Team Workload ·
Decision Center (recommendations, what-if simulator, decision log) · Reports & Analytics

**Organization Admin:** User Management (incl. per-employee permissions) · Roles & Permissions ·
Organization Settings (incl. automation rules) · Audit Log

**System Admin:** Organizations & System Management

Plus 403, 404 and a top-level error boundary.

## Documentation

- [Backend - structure, request flow, permissions, insights, Decision Center](backend-express/README.md)
- [Frontend](frontend/README.md)
- [Main use cases](docs/use-cases.md)
- [Accessibility](docs/accessibility.md)

## Known limitations

- Forgot-password returns the reset token in the API response instead of emailing it - no
  external email provider is configured, so the project runs locally with no paid services.
- Attachments are stored on the server's local disk (`backend-express/uploads`).
- Voice / Zoom calls need Zoom Server-to-Server OAuth credentials in `backend-express/.env`;
  until then the call buttons explain that calls are not configured.
