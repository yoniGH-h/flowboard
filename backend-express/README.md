# FlowBoard API — Node.js + Express

The FlowBoard REST API written with plain **Node.js + Express** (JavaScript, no build step),
using **Prisma** for PostgreSQL and **Socket.IO** for real-time notifications. The React app in
`../frontend` talks to it over REST (`/api/*`) and Socket.IO.

## Run it

Easiest (from the `flowboard` folder — starts Postgres, this API and the frontend):

```powershell
.\start-dev.ps1          # add -Seed to reload the demo data
.\stop-dev.ps1
```

Manually:

```bash
cd backend-express
cp .env.example .env
npm install                 # also runs `prisma generate`
npm run prisma:migrate      # create the tables in the flowboard_express database
npm run prisma:seed         # demo data (wipes existing data!)
npm start                   # http://localhost:3000/api   (npm run dev = restart on file changes)

cd ../frontend
npm run dev                 # the React app, pointed at this API
```

Demo login: `daniel.cho@nimbusdigital.io` / `password123` (all seeded users share that password).

## Folder layout

```
backend-express/
  prisma/
    schema.prisma        database model
    migrations/          SQL migrations, applied by `prisma migrate deploy`
    seed.js              demo data
  src/
    server.js            entry point: HTTP server + Socket.IO + the 15-minute automation scan
    app.js               the Express app: global middleware and every /api route
    config.js            settings from .env
    db.js                the shared Prisma client
    middleware/
      auth.js            requireAuth (JWT) and requireRole('PROJECT_MANAGER')
      errorHandler.js    every error -> { statusCode, path, timestamp, message }
    realtime/socket.js   Socket.IO: authenticates connections, emitToUser()
    utils/               HttpError helpers, zod validation, role levels, slugify
    modules/             one folder per feature
      auth/              sign-up, join, sign-in, refresh-token rotation, password reset
      users/             profile, org user management
      organizations/     org settings, System Admin org list/suspend
      roles/  labels/    read-only lists
      projects/          projects, members, Kanban board and columns, risk.js (delay-risk score)
      tasks/             task CRUD, move (WIP limits), dependencies, tasks.reports.js (dashboards)
      comments/  attachments/  notifications/  audit-log/
      automation-rules/  the "when X, do Y" engine
```

Each module has a `*.routes.js` file (URLs, validation, required role) and, for the larger
ones, a `*.service.js` file (the business logic and database queries).

## How a request flows

`PATCH /api/tasks/:id/move` as an example:

1. `app.js` global middleware: security headers (helmet), CORS, JSON body parsing, rate limit.
2. `requireAuth` verifies the `Authorization: Bearer <token>` JWT, re-checks the user is still
   ACTIVE, and puts `{ userId, organizationId, email, roles }` on `req.user`.
3. `tasks.routes.js` validates the body with zod (`parse(moveSchema, req.body)`).
4. `tasks.service.js` `move()` checks organization/project access, that an Employee only moves
   their own card, the column's WIP limit (409), and blocking dependencies; then updates the
   task, writes history + audit rows, notifies the assignee, and runs automation rules.
5. Any `throw notFound(...)` / `conflict(...)` on the way is turned into the JSON error response
   by `errorHandler.js` (Express 5 forwards errors from async handlers automatically).

## Permissions: role defaults + organization changes + personal exceptions

Every check uses a permission key (`tasks.manage`, `audit.view`, ...), not a role. What a user
may do is computed on every request in three layers (`src/permissions/effective.js`):

```
effective permissions = defaults of the user's roles        (src/permissions/catalog.js)
                      + the organization's changes to those roles   (OrganizationRolePermission)
                      + the user's personal exceptions: allow / deny, optional expiry
                                                                    (UserPermissionOverride)
```

- **Catalog** (`catalog.js`): every permission, its role defaults, and its **scope** -
  `organization`, `member-project` (projects you belong to), `managed-project` (only projects you
  manage), or `system` (platform, never changeable).
- **Enforcement**: `requirePermission('audit.view')` on routes for organization-wide permissions;
  `assertProjectPermission(actor, projectId, 'tasks.manage')` in services for project-scoped ones,
  so a permission never overrides project ownership.
- **Editing** (`/api/permissions/*`, needs `permissions.manage`): the Roles & Permissions matrix,
  and User Management → Permissions for exceptions. Guard rails: platform permissions are
  unchangeable; you can only grant what you have yourself; no editing your own permissions or
  those of a higher role; `users.manage` / `permissions.manage` can't be removed from Org Admins
  (no lock-out); project-management permissions only for Project Managers; every change is
  audited.
- Each project in a response carries `can` (update, manageTasks, createTasks, comment, upload...)
  and `/users/me` carries `permissions`, so the frontend shows only what is allowed.
- `npm run test:permissions` runs 34 checks against a running, freshly seeded server.

## Who controls which project

| Role | Controls |
| --- | --- |
| Org Admin / System Admin | every project in the organization |
| Project Manager | only the projects they manage (`project.managerId`, or a member with `roleOnProject = MANAGER`) |
| Project Manager in someone else's project | the same as an employee: they can see it only if they are a member, and move only their own tasks |

- The rule lives in one place: `managesProject()` / `managedProjectsWhere()` in
  `modules/projects/projects.service.js`. Every management action goes through
  `assertAccessible(actor, projectId, { requireManager: true })`.
- A Project Manager creates projects only with themselves as manager. Assigning a different
  manager or a co-manager (`MANAGER` member) is reserved for Org Admins.
- Management Dashboard / Team Workload / Reports cover only the caller's managed projects.
- Every project in an API response carries `canManage`, which the frontend uses to show or
  hide management controls (the server enforces the rule either way).

## Insights (Reports & Analytics → "Key conclusions")

`GET /api/insights?projectId=` (needs `reports.view`, covers only the projects the caller
manages) turns data FlowBoard already collects into conclusions a manager can act on
(`modules/insights/insights.service.js`):

| Insight | Computed from | Example conclusion |
| --- | --- | --- |
| Delivery forecast | open tasks ÷ tasks completed in the last 4 weeks | "Atlas will finish around Nov 23 - 26 days after its target." (no date is claimed from fewer than 3 completed tasks) |
| Estimate accuracy | `actualHours` vs `estimatedHours` of completed tasks | "The team underestimates: tasks take 30% longer than estimated." |
| Where work waits | `TaskStatusChange` - every column a task entered, and when | "Work waits longest in In Review: 7.4 days on average." + the tasks stuck longest |
| Risk trend | `ProjectRiskSnapshot` - one risk score per project per day, recorded hourly by `server.js` | "Nimbus Mobile Revamp's delay risk rose from 30 to 52 in two weeks." |

`GET /api/projects/:id/risk-history?days=30` feeds the risk chart on the project page. The seed
builds 30 days of history by replaying the demo tasks' dates through the same risk formula.

## Decision Center (Management → Decision Center)

Closes the loop from insight to action: **detect → recommend → simulate → apply → measure**.
All of it runs on one small, transparent model (`modules/planning/model.js`) that turns a
project's state into a forecast, a delay risk and everyone's workload, and applies what-if
changes to a copy of that state.

| Part | Endpoint | What it does |
| --- | --- | --- |
| What-if simulator | `POST /api/planning/projects/:id/simulate` | Evaluates changes - reassign tasks, defer tasks, add people, resolve blockers, move the target date - **without saving anything**, and returns before / after (forecast, days late, risk and every risk factor, workload) plus the assumptions used. |
| Recommendations | `GET /api/planning/projects/:id/recommendations` | Explainable rules: *rebalance* a stuck task or an over-capacity person's task to a member with clearly more room; *defer* not-started low-priority tasks when the project is late; *add* a free person when it is late. Each one is simulated, and only kept if it improves something. |
| Apply | `POST /api/planning/projects/:id/decisions` | Carries the changes out through the normal task / project services (same permission checks, notifications and audit entries as doing it by hand) and records a `Decision` with the risk and forecast at that moment and what the model predicted. |
| Decision log | `GET /api/planning/decisions` | Every decision with *then → predicted → now* for risk and days late - did it actually help? |

Scope: `reports.view`, plus `tasks.manage` in the project (so a Project Manager only plans
their own projects); applying also checks `members.manage` / `projects.update` when needed.
`npm run test:planning` exercises the whole flow against a running, freshly seeded server.

## Voice / Zoom calls

`POST /api/meetings` `{ inviteeId, mode: 'voice' | 'video', projectId?, taskId? }` creates an
instant Zoom meeting (`voice` = cameras off). The caller receives `startUrl` and joins as host;
the invitee gets a real-time `MEETING_INVITE` notification with a "Join call" button.

Setup: at https://marketplace.zoom.us create a **Server-to-Server OAuth** app with the
`meeting:write` scope, activate it, and fill in `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID` and
`ZOOM_CLIENT_SECRET` in `.env`. Until then the endpoint answers 503 with an explanation, and
the buttons show that message.

## Notes

- Database: `flowboard_express` on the local PostgreSQL (port 5433).
- Attachments are stored on local disk in `uploads/`.
- No Swagger page — every endpoint is defined in its module's `*.routes.js` file.
