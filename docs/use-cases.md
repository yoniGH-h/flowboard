# Main use cases

## UC-1: Employee completes assigned work

1. Signs in, lands on the Personal Dashboard showing assigned/overdue/due-soon tasks.
2. Opens a project's Kanban board, finds their card.
3. Drags it to "In Review" - blocked by the column's WIP limit if it's full (`409`), otherwise
   persisted immediately via `PATCH /tasks/:id/move`.
4. Adds a comment describing what changed; uploads a screenshot as an attachment.
5. Teammates watching the task (assignee/creator) get a `COMMENT_ADDED` notification.

## UC-2: Project Manager stands up a new project

1. Signs in with Project Manager (or higher) role.
2. Creates a project (`POST /projects`) with a manager, start/target date, and initial members -
   a board with the five default columns is created automatically.
3. Adds the remaining team members (`POST /projects/:id/members`).
4. Creates tasks for the sprint (`POST /tasks`), assigning each to a team member - assignees are
   notified.
5. Monitors the board day-to-day; reassigns or archives tasks as priorities shift.

## UC-3: Organization Administrator onboards a new hire

1. The new hire signs up via "Join organization" with the org's slug, landing as an Employee.
2. The Org Admin opens User Management, finds the new account, and assigns it the Project Manager
   role if warranted (`PATCH /users/:id/roles`) - granting System Administrator specifically
   requires the actor to already hold that role.
3. The action is recorded in the Audit Log with the acting admin, the target user, and the new
   role set - no passwords or tokens included.

## UC-4: A user leaves and their access needs to be revoked

1. Org Admin suspends the account (`PATCH /users/:id/status`) - the user can no longer sign in
   (`JwtStrategy` and `AuthService.signIn` both check `status === 'ACTIVE'`), while their historical
   tasks/comments/audit rows remain intact.
2. If the Org Admin instead tries to **delete** the user and that user still owns projects or
   created tasks, the API returns `409 Conflict` explaining that suspension is the safer action -
   this is a deliberate guard against silently orphaning history (see `docs/security.md`).

## UC-5: A manager reads the project's delay-risk score

1. Opens Project Overview; sees a risk score (0-100) and level (Low/Medium/High).
2. Expands the contributing factors (overdue-task percentage, blocked-task percentage, team
   workload, remaining time, progress vs. plan) with point-by-point breakdowns - never a bare
   number - so the manager can see and question *why* the score is what it is.
3. In Phase 2/3 this is seeded/stored data (mirroring what Phase 1's mock UI already showed); the
   live recalculation service is Phase 5.

## UC-6: Cross-tenant isolation (negative case, exercised by tests in Phase 6)

1. A user from Organization A obtains the id of a task belonging to Organization B (e.g. by
   incrementing an id it can see, or from a stale link).
2. `GET /tasks/:id` (and every other project-scoped endpoint) resolves the task's project first,
   filtered by the caller's own `organizationId` - the row from another org simply does not match
   the query, so the API returns `404 Not Found`, not `403 Forbidden` (it does not confirm the
   record exists at all) and never returns its data.
