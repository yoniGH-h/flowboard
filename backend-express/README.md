# FlowBoard API (Node.js + Express)

This is the backend of FlowBoard. It's a REST API written in **Node.js + Express** (plain JavaScript, no build step). It uses **Prisma** to talk to PostgreSQL and **Socket.IO** for real-time notifications. The React app in `../frontend` talks to it through REST (`/api/*`) and Socket.IO.

## Running it

The easy way, from the `flowboard` folder (starts PostgreSQL, the server and the site):

```powershell
.\start-dev.ps1          # add -Seed to reload the demo data
.\stop-dev.ps1
```

Or by hand:

```bash
cd backend-express
cp .env.example .env
npm install                 # also runs prisma generate
npm run prisma:migrate      # creates the tables in the flowboard_express database
npm run prisma:seed         # demo data (this deletes the existing data!)
npm start                   # http://localhost:3000/api   (npm run dev restarts on every change)

cd ../frontend
npm run dev                 # the React app, connected to this server
```

Demo login: `daniel.cho@nimbusdigital.io` / `password123` (all demo users have the same password).

## Architecture

I split the server into layers. Every layer has one job, and it only talks to the layer next to it:

```
HTTP request
   │
   ▼
app.js          global middleware: helmet, compression, CORS, JSON body, cookies, rate limit
   │
   ▼
middleware/     requireAuth (who is the user?), requirePermission / requireRole
   │
   ▼
*.routes.js     the URL + HTTP method, input validation with zod, then calls the service
   │
   ▼
*.service.js    the business logic: permission checks on the specific project/task,
   │            rules (WIP limit, dependencies...), audit log, notifications
   ▼
db.js           the shared Prisma client + inTransaction() / afterCommit()
   │
   ▼
PostgreSQL
```

A few things I think are worth explaining:

- **Routes are thin.** A route file only reads the params, validates the body with zod and calls the service. All the rules are in the services, so the same rule works no matter who calls it (a route, the Decision Center, or an automation rule).
- **Errors go up by themselves.** A service just does `throw notFound('Task')` or `throw conflict(...)`. Express 5 passes errors from async functions to `errorHandler.js` automatically, and it turns them into one JSON format: `{ statusCode, path, timestamp, message }`. Unknown errors become a 500 and the details only go to the log.
- **Transactions.** `inTransaction(fn)` in `db.js` runs everything inside `fn` as one transaction. It uses `AsyncLocalStorage`, so any service function that is called inside joins the same transaction without me passing `tx` around. If something fails, everything is rolled back.
- **afterCommit.** Things like Socket.IO notifications are queued with `afterCommit()` and only run after the transaction is saved. This way users never get a notification about a change that was rolled back.
- **Real time.** `realtime/socket.js` checks the JWT when a socket connects and puts each user in their own room. Services call `emitToUser(userId, ...)` to send them events.
- **Background jobs.** `server.js` also runs two timers: an automation scan every 15 minutes, and a risk score snapshot every hour (used for the risk trend chart).

## Folder structure

```
backend-express/
  prisma/
    schema.prisma        the database structure
    migrations/          the SQL files that build the database (prisma migrate deploy)
    seed.js              demo data
  test/                  permission, Decision Center and transaction tests
  src/
    server.js            entry point: HTTP server + Socket.IO + background jobs
    app.js               the Express app: global middleware and all the /api routes
    config.js            settings from the .env file
    db.js                the shared Prisma client, inTransaction(), afterCommit()
    middleware/
      auth.js            requireAuth (checks the JWT), requirePermission, requireRole
      errorHandler.js    turns every error into { statusCode, path, timestamp, message }
    permissions/
      catalog.js         all the permissions, the default for each role, and each permission's scope
      effective.js       calculates the user's actual permissions (3 layers)
    realtime/socket.js   Socket.IO: authenticates connections, emitToUser()
    utils/               HTTP errors, zod validation, role levels, slugify
    modules/             one folder per topic
      auth/              sign up, join an organization, sign in, token refresh, password reset
      users/             profile, managing users in the organization
      organizations/     organization settings; list and suspend organizations (system admin)
      roles/  labels/    read-only lists
      projects/          projects, team members, board and columns, risk.js (the risk score)
      tasks/             tasks, moving on the board (WIP), dependencies, tasks.reports.js (dashboards)
      comments/  attachments/  notifications/  audit-log/
      automation-rules/  the "when X, do Y" engine
      permissions/       editing the permission matrix and per-user overrides
      insights/          insights and conclusions
      planning/          the Decision Center: model, simulation, recommendations, decision log
      meetings/          voice / Zoom calls
```

Every module has a `*.routes.js` file (URLs, input validation and permission checks), and the bigger modules also have a `*.service.js` file (the business logic and the database queries).

## How a request goes through the system

For example, `PATCH /api/tasks/:id/move` (moving a task on the board):

1. **`app.js`**: the global middleware runs: security headers (helmet), CORS, JSON body parsing and the rate limit.
2. **`requireAuth`**: checks the JWT in the `Authorization: Bearer <token>` header, makes sure the user is still active, and puts `{ userId, organizationId, email, roles, permissions }` in `req.user`.
3. **`tasks.routes.js`**: validates the request body with zod.
4. **`tasks.service.js` → `move()`**: checks access to the organization and the project, checks that an employee only moves their own task, checks the column's WIP limit (409 error) and blocking tasks. Then it updates the task, saves the history and the audit log, notifies the assignee and runs the automation rules.
5. Any `throw notFound(...)` or `conflict(...)` on the way becomes a JSON error response in `errorHandler.js`.

## Permissions: role defaults + organization changes + personal overrides

The code checks permission keys (`tasks.manage`, `audit.view` and so on), not role names. What a user can do is calculated on every request in three layers (`src/permissions/effective.js`):

```
actual permissions = the defaults of the user's roles           (src/permissions/catalog.js)
                   + the organization's changes to those roles  (OrganizationRolePermission)
                   + personal overrides: grant / deny, with an optional end date
                                                                (UserPermissionOverride)
```

- **The catalog** (`catalog.js`) has every permission, its default for each role, and its **scope**: `organization` (the whole organization), `member-project` (projects the user is a member of), `managed-project` (only projects they manage), or `system` (platform level, can't be changed).
- **Enforcement:** `requirePermission('audit.view')` on routes for organization-level permissions, and `assertProjectPermission(actor, projectId, 'tasks.manage')` inside services for project-level permissions. This way a permission never skips the project ownership check.
- **Editing** (`/api/permissions/*`, needs `permissions.manage`): the role/permission matrix, and per-user overrides from User management → Permissions. Safety rules: you can't change platform permissions; you can only give a permission you have yourself; you can't change your own permissions or those of someone with a higher role; you can't remove `users.manage` / `permissions.manage` from org admins (so nobody gets locked out); project management permissions only go to project managers; every change is written to the audit log.
- Every project in a server response includes `can` (update, manage tasks, create tasks, comment, upload...), and `/users/me` includes `permissions`, so the site only shows what the user is allowed to do. The server still checks everything.
- `npm run test:permissions` runs the permission tests against a running server with fresh demo data.

## Who controls which project

| Role | Controls |
| --- | --- |
| Org admin / system admin | All the projects in the organization |
| Project manager | Only the projects they manage (`project.managerId`, or a team member with `roleOnProject = MANAGER`) |
| Project manager in someone else's project | Same as an employee: sees it only if they're a member, and moves only their own tasks |

- The rule lives in one place: `managesProject()` / `managedProjectsWhere()` in `modules/projects/projects.service.js`. Every management action goes through `assertAccessible(actor, projectId, { requireManager: true })`.
- A project manager can only create a project where they are the manager. Choosing a different manager or a co-manager (a `MANAGER` team member) is only for org admins.
- The management dashboard, team workload and reports only cover the projects the user manages.
- Every project in a response includes `canManage`, and the site uses it to show or hide management actions (the server enforces the rule anyway).

## Insights (Reports & Insights → "Key conclusions")

`GET /api/insights?projectId=` (needs `reports.view`, and only covers projects the user manages) turns data that FlowBoard already collects into conclusions a manager can act on (`modules/insights/insights.service.js`):

| Insight | Calculated from | Example |
| --- | --- | --- |
| Forecast finish date | open tasks ÷ tasks completed in the last 4 weeks | "Atlas will finish around November 23, 26 days after the deadline." (no date is shown if fewer than 3 tasks were completed) |
| Estimation accuracy | `actualHours` vs `estimatedHours` of completed tasks | "The team underestimates: tasks take 30% longer than estimated." |
| Where work waits | `TaskStatusChange`: every column a task entered, and when | "Work waits the longest in In Review: 7.4 days on average." + the tasks that have been stuck the longest |
| Risk trend | `ProjectRiskSnapshot`: one risk score per project per day, saved every hour in `server.js` | "The risk of Nimbus Mobile Revamp went up from 30 to 52 in two weeks." |

`GET /api/projects/:id/risk-history?days=30` feeds the risk chart on the project page. The seed builds 30 days of history by running the dates of the demo tasks through the same risk formula.

## Decision Center (Management → Decision Center)

This part closes the loop from an insight to an action: **detect → recommend → simulate → apply → measure**. Everything runs on one small and transparent model (`modules/planning/model.js`). It turns the project's state into a forecast finish date, a risk score and each person's workload, and it can apply "what if" changes to a copy of that state.

| Part | URL | What it does |
| --- | --- | --- |
| "What if" simulator | `POST /api/planning/projects/:id/simulate` | Tries changes (moving tasks, deferring tasks, adding people, removing blockers, moving the deadline) **without saving anything**, and returns before / after (forecast, days late, the risk and each of its factors, workload) plus the assumptions behind the calculation. |
| Recommendations | `GET /api/planning/projects/:id/recommendations` | Simple rules you can explain: *rebalance*: move a stuck task, or a task of an overloaded person, to a team member who is clearly free; *defer*: low-priority tasks that haven't started, when the project is late; *add*: a free employee, when the project is late. Every recommendation is simulated first, and it's only kept if it actually improves something. |
| Apply | `POST /api/planning/projects/:id/decisions` | Applies the changes through the normal task and project services (same permission checks, notifications and audit log as doing it by hand), all in one transaction, and saves a `Decision` with the risk and forecast at that moment and what the model predicted. |
| Decision log | `GET /api/planning/decisions` | Every decision with *then → predicted → now* for the risk and the days late. Did it really help? |

Scope: needs `reports.view`, and also `tasks.manage` in the project (so a project manager only plans their own projects). Applying also checks `members.manage` / `projects.update` when needed. `npm run test:planning` tests the whole flow against a running server with fresh demo data.

## Voice / Zoom calls

`POST /api/meetings` `{ inviteeId, mode: 'voice' | 'video', projectId?, taskId? }` creates an instant Zoom meeting (`voice` = cameras off). The caller gets a `startUrl` and joins as the host. The other person gets a real-time `MEETING_INVITE` notification with a "Join call" button.

Setup: on https://marketplace.zoom.us create a **Server-to-Server OAuth** app with the `meeting:write` scope, activate it, and fill `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET` in `.env`. Until then the server returns 503 with an explanation, and the buttons show that message.

## Notes

- Database: `flowboard_express` on the local PostgreSQL (port 5433).
- Attachments are saved on the local disk in `uploads/`.
- There's no Swagger page. Every URL is defined in its module's `*.routes.js` file.
