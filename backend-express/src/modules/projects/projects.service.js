import { prisma } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { PERMISSION_BY_KEY } from '../../permissions/catalog.js';
import { isManager, isOrgAdmin } from '../../utils/permissions.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { calculateRisk } from './risk.js';

// Every new project gets a Kanban board with these columns.
const DEFAULT_COLUMNS = [
  { name: 'Backlog', category: 'TODO', order: 0 },
  { name: 'To Do', category: 'TODO', order: 1 },
  { name: 'In Progress', category: 'IN_PROGRESS', order: 2, wipLimit: 5 },
  { name: 'In Review', category: 'REVIEW', order: 3, wipLimit: 4 },
  { name: 'Done', category: 'DONE', order: 4 },
];

const USER_BRIEF = { select: { id: true, firstName: true, lastName: true, avatarColor: true } };
const USER_WITH_TITLE = { select: { id: true, firstName: true, lastName: true, avatarColor: true, title: true } };

const DETAIL_INCLUDE = {
  manager: USER_WITH_TITLE,
  members: { include: { user: USER_WITH_TITLE } },
  board: { select: { id: true } },
  _count: { select: { tasks: true } },
};

// ---------- Who may manage which project ----------
//
//   Org Admin / System Admin  -> every project in their organization
//   Project Manager           -> only the projects they manage: they are the project's
//                                manager, or a member with roleOnProject = MANAGER
//   everyone else             -> none (members can still view and work on their tasks)

// project must include `members` (rows with userId + roleOnProject).
export function managesProject(actor, project) {
  if (isOrgAdmin(actor)) return true;
  if (!isManager(actor)) return false;
  return (
    project.managerId === actor.userId ||
    project.members.some((m) => m.userId === actor.userId && m.roleOnProject === 'MANAGER')
  );
}

// The same rule as a Prisma `where` on Project - "the projects this actor manages".
export function managedProjectsWhere(actor) {
  if (isOrgAdmin(actor)) return { organizationId: actor.organizationId };
  return {
    organizationId: actor.organizationId,
    OR: [{ managerId: actor.userId }, { members: { some: { userId: actor.userId, roleOnProject: 'MANAGER' } } }],
  };
}

// Projects the actor can see: every org project for Org Admins, otherwise the ones they
// belong to (a project's manager is always one of its members).
export function visibleProjectsWhere(actor) {
  if (isOrgAdmin(actor)) return { organizationId: actor.organizationId };
  return {
    organizationId: actor.organizationId,
    OR: [{ managerId: actor.userId }, { members: { some: { userId: actor.userId } } }],
  };
}

const isMember = (actor, project) => project.members.some((m) => m.userId === actor.userId);

// May the actor use this permission in THIS project? Two conditions:
//   1. they have the permission (role defaults + org changes + personal exceptions), and
//   2. its scope fits the project: 'managed-project' permissions work only in projects they
//      manage, 'member-project' ones in any project they belong to.
export function projectCan(actor, project, key) {
  if (!actor.permissions.has(key)) return false;
  const scope = PERMISSION_BY_KEY.get(key)?.scope;
  if (scope === 'managed-project') return managesProject(actor, project);
  if (scope === 'member-project') return managesProject(actor, project) || isMember(actor, project);
  return true;
}

// Everything the frontend needs to show or hide buttons for one project.
// (The server checks the same rules again on every request.)
function projectAbilities(actor, project) {
  const can = (key) => projectCan(actor, project, key);
  return {
    update: can('projects.update'),
    manageMembers: can('members.manage'),
    configureBoard: can('board.configure'),
    manageTasks: can('tasks.manage'),
    createTasks: can('tasks.manage') || can('tasks.create'),
    moveOwnTasks: can('tasks.move.own') || can('tasks.manage'),
    comment: can('comments.create'),
    upload: can('attachments.upload'),
    moderate: can('content.moderate'),
  };
}

// Flattens the Prisma result into the shape the frontend expects, plus `can` (what the
// signed-in user may do here) and `canManage` (kept for older frontend code = can.manageTasks).
function toDetail(project, actor) {
  const { _count, board, members, ...rest } = project;
  const can = projectAbilities(actor, project);
  return {
    ...rest,
    boardId: board?.id ?? null,
    taskCount: _count.tasks,
    can,
    canManage: can.manageTasks,
    members: members.map((m) => ({ ...m.user, roleOnProject: m.roleOnProject, joinedAt: m.joinedAt })),
  };
}

// Overwrites each project's stored risk fields with a freshly computed score. One query
// fetches the open tasks of all the projects at once (not one query per project).
async function attachLiveRisk(details) {
  if (details.length === 0) return details;

  const openTasks = await prisma.task.findMany({
    where: { projectId: { in: details.map((d) => d.id) }, archived: false, completedAt: null },
    select: { projectId: true, assigneeId: true, dueDate: true, blocked: true },
  });

  const tasksByProject = new Map();
  for (const t of openTasks) {
    if (!tasksByProject.has(t.projectId)) tasksByProject.set(t.projectId, []);
    tasksByProject.get(t.projectId).push(t);
  }

  const now = new Date();
  return details.map((d) => ({
    ...d,
    ...calculateRisk(d, tasksByProject.get(d.id) ?? [], d.members.length, now),
  }));
}

// ---------- Risk history ----------

const DAY_MS = 86_400_000;
const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Saves today's risk score of every active project (one row per project per day - running it
// again the same day just updates the row). Called when the server starts and every hour
// (server.js), so the insights can show how risk changes over time.
export async function recordRiskSnapshots(now = new Date()) {
  const projects = await prisma.project.findMany({ where: { archived: false }, include: { members: true } });
  const withRisk = await attachLiveRisk(projects);
  const day = startOfUtcDay(now);
  for (const p of withRisk) {
    await prisma.projectRiskSnapshot.upsert({
      where: { projectId_day: { projectId: p.id, day } },
      update: { riskScore: p.riskScore, riskLevel: p.riskLevel },
      create: { projectId: p.id, day, riskScore: p.riskScore, riskLevel: p.riskLevel },
    });
  }
  return withRisk.length;
}

// GET /api/projects/:id/risk-history - the project's daily risk scores for the last `days` days.
export async function getRiskHistory(actor, projectId, days = 30) {
  await assertAccessible(actor, projectId);
  const since = startOfUtcDay(new Date(Date.now() - days * DAY_MS));
  return prisma.projectRiskSnapshot.findMany({
    where: { projectId, day: { gte: since } },
    orderBy: { day: 'asc' },
    select: { day: true, riskScore: true, riskLevel: true },
  });
}

async function loadDetail(actor, id) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE });
  const [detail] = await attachLiveRisk([toDetail(project, actor)]);
  return detail;
}

// Used by the Tasks/Comments/Attachments/Meetings modules too. The project must belong to
// the actor's organization, and the actor must be a member of it or manage it.
// Returns the project (with members) plus `can(key)` - projectCan bound to this project.
export async function assertAccessible(actor, projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
    include: { members: true },
  });
  if (!project) throw notFound('Project not found');

  if (!managesProject(actor, project) && !isMember(actor, project)) {
    throw forbidden('You are not a member of this project');
  }
  return { ...project, can: (key) => projectCan(actor, project, key) };
}

// assertAccessible + "and may use this permission here" - the check behind every project action.
//   await assertProjectPermission(actor, projectId, 'tasks.manage')
export async function assertProjectPermission(actor, projectId, key) {
  const project = await assertAccessible(actor, projectId);
  if (!project.can(key)) {
    const scope = PERMISSION_BY_KEY.get(key)?.scope;
    throw forbidden(
      scope === 'managed-project' && actor.permissions.has(key)
        ? "Only this project's manager (or an organization admin) can do this"
        : 'You do not have permission to perform this action',
    );
  }
  return project;
}

// A project manager must hold the Project Manager role (or higher) in the organization.
async function requireEligibleManager(actor, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw notFound('Selected manager was not found in your organization');
  if (!isManager({ roles: user.roles.map((r) => r.role.name) })) {
    throw badRequest(`${user.firstName} ${user.lastName} is not a Project Manager`);
  }
}

export async function create(actor, dto) {
  // A Project Manager creates projects for themselves; only Org Admins pick another manager.
  if (!isOrgAdmin(actor) && dto.managerId !== actor.userId) {
    throw forbidden('Project Managers can only create projects that they manage themselves');
  }
  await requireEligibleManager(actor, dto.managerId);

  // The manager and the creator are always members.
  const memberIds = new Set([dto.managerId, actor.userId, ...(dto.memberIds ?? [])]);

  const members = await prisma.user.findMany({
    where: { id: { in: [...memberIds] }, organizationId: actor.organizationId },
  });
  if (members.length !== memberIds.size) {
    throw notFound('One or more selected members were not found in your organization');
  }

  // Project, members, board and columns are created together in one nested write.
  const project = await prisma.project.create({
    data: {
      organizationId: actor.organizationId,
      name: dto.name,
      description: dto.description,
      managerId: dto.managerId,
      startDate: dto.startDate,
      targetDate: dto.targetDate,
      status: 'PLANNING',
      progress: 0,
      riskScore: 0,
      riskLevel: 'LOW',
      riskFactors: [],
      members: {
        create: [...memberIds].map((userId) => ({
          userId,
          roleOnProject: userId === dto.managerId ? 'MANAGER' : 'CONTRIBUTOR',
        })),
      },
      board: {
        create: { name: `${dto.name} Board`, columns: { create: DEFAULT_COLUMNS } },
      },
    },
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_CREATED',
    entityType: 'Project',
    entityId: project.id,
    projectId: project.id,
    metadata: { name: project.name },
  });

  return loadDetail(actor, project.id);
}

export async function findAll(actor, query) {
  const wantsAll = query.scope === 'all';
  if (wantsAll && !isManager(actor)) {
    throw forbidden('You do not have permission to view all organization projects');
  }

  const projects = await prisma.project.findMany({
    where: {
      // "all" = every project the caller manages (for an Org Admin: the whole organization);
      // "mine" = the projects the caller is a member of.
      ...(wantsAll
        ? managedProjectsWhere(actor)
        : { organizationId: actor.organizationId, members: { some: { userId: actor.userId } } }),
      archived: query.includeArchived === 'true' ? undefined : false,
      status: query.status,
      name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    },
    include: DETAIL_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return attachLiveRisk(projects.map((p) => toDetail(p, actor)));
}

export async function findOne(actor, id) {
  await assertAccessible(actor, id);
  return loadDetail(actor, id);
}

export async function update(actor, id, dto) {
  const project = await assertProjectPermission(actor, id, 'projects.update');
  const managerChanges = dto.managerId && dto.managerId !== project.managerId;

  if (managerChanges) {
    // Handing a project to someone else is an Org Admin decision - otherwise a Project
    // Manager could give away (or take over) control of a project.
    if (!isOrgAdmin(actor)) {
      throw forbidden('Only an organization admin can assign a project to a different manager');
    }
    await requireEligibleManager(actor, dto.managerId);
  }

  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: dto }),
    // Keep the member list in sync: the new manager is a MANAGER member, the old one a contributor.
    ...(managerChanges
      ? [
          prisma.projectMember.updateMany({
            where: { projectId: id, userId: project.managerId, roleOnProject: 'MANAGER' },
            data: { roleOnProject: 'CONTRIBUTOR' },
          }),
          prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: id, userId: dto.managerId } },
            update: { roleOnProject: 'MANAGER' },
            create: { projectId: id, userId: dto.managerId, roleOnProject: 'MANAGER' },
          }),
        ]
      : []),
  ]);

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: id,
    projectId: id,
    metadata: { fields: Object.keys(dto) },
  });

  return loadDetail(actor, id);
}

export async function setArchived(actor, id, archived) {
  await assertProjectPermission(actor, id, 'projects.update');
  await prisma.project.update({ where: { id }, data: { archived } });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: archived ? 'PROJECT_ARCHIVED' : 'PROJECT_UNARCHIVED',
    entityType: 'Project',
    entityId: id,
    projectId: id,
  });

  return loadDetail(actor, id);
}

// ---------- Members ----------

// roleOnProject = MANAGER makes someone a co-manager with full control of the project, so
// only an Org Admin may grant it (just like reassigning the project's manager).
function assertCanGrantRole(actor, roleOnProject) {
  if (roleOnProject === 'MANAGER' && !isOrgAdmin(actor)) {
    throw forbidden('Only an organization admin can make someone a manager of this project');
  }
}

export async function addMember(actor, projectId, dto) {
  await assertProjectPermission(actor, projectId, 'members.manage');
  assertCanGrantRole(actor, dto.roleOnProject);

  const user = await prisma.user.findFirst({
    where: { id: dto.userId, organizationId: actor.organizationId },
  });
  if (!user) throw notFound('User not found in your organization');

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: dto.userId } },
  });
  if (existing) throw conflict('This user is already a member of the project');

  await prisma.projectMember.create({
    data: { projectId, userId: dto.userId, roleOnProject: dto.roleOnProject ?? 'CONTRIBUTOR' },
  });

  await createNotification({
    organizationId: actor.organizationId,
    userId: dto.userId,
    type: 'MEMBER_ADDED',
    title: 'Added to a project',
    body: 'You were added to a project.',
    relatedProjectId: projectId,
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_MEMBER_ADDED',
    entityType: 'Project',
    entityId: projectId,
    projectId,
    metadata: { userId: dto.userId },
  });

  return findOne(actor, projectId);
}

export async function updateMember(actor, projectId, userId, dto) {
  const project = await assertProjectPermission(actor, projectId, 'members.manage');
  const member = await requireMember(projectId, userId);
  // Promoting to MANAGER, or demoting an existing co-manager, both change who controls the project.
  assertCanGrantRole(actor, dto.roleOnProject);
  assertCanGrantRole(actor, member.roleOnProject);
  if (userId === project.managerId && dto.roleOnProject !== 'MANAGER') {
    throw conflict("The project's manager must keep the MANAGER role. Reassign the manager first.");
  }
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { roleOnProject: dto.roleOnProject },
  });
  return findOne(actor, projectId);
}

export async function removeMember(actor, projectId, userId) {
  const project = await assertProjectPermission(actor, projectId, 'members.manage');
  if (project.managerId === userId) {
    throw conflict('The project manager cannot be removed from the project. Reassign the manager first.');
  }
  const member = await requireMember(projectId, userId);
  assertCanGrantRole(actor, member.roleOnProject); // removing a co-manager is an Org Admin decision

  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_MEMBER_REMOVED',
    entityType: 'Project',
    entityId: projectId,
    projectId,
    metadata: { userId },
  });

  return findOne(actor, projectId);
}

async function requireMember(projectId, userId) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw notFound('This user is not a member of the project');
  return member;
}

// ---------- Project-wide files and activity ----------

export async function getAttachments(actor, projectId) {
  await assertAccessible(actor, projectId);
  return prisma.attachment.findMany({
    where: { task: { projectId } },
    orderBy: { uploadedAt: 'desc' },
    include: { uploadedBy: USER_BRIEF },
  });
}

export async function getActivity(actor, projectId) {
  await assertAccessible(actor, projectId);
  return prisma.activityEntry.findMany({
    where: { task: { projectId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { actor: USER_BRIEF },
  });
}

// ---------- Kanban board ----------

export async function getBoard(actor, projectId) {
  await assertAccessible(actor, projectId);
  const board = await prisma.board.findUnique({
    where: { projectId },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { archived: false },
            orderBy: { createdAt: 'asc' },
            include: {
              assignee: USER_BRIEF,
              labels: { include: { label: true } },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });
  if (!board) throw notFound('Board not found');
  return board;
}

export async function addColumn(actor, projectId, dto) {
  await assertProjectPermission(actor, projectId, 'board.configure');
  const board = await prisma.board.findUnique({ where: { projectId }, include: { columns: true } });
  if (!board) throw notFound('Board not found');

  await prisma.boardColumn.create({
    data: { boardId: board.id, order: board.columns.length, ...dto },
  });
  return getBoard(actor, projectId);
}

export async function updateColumn(actor, projectId, columnId, dto) {
  await assertProjectPermission(actor, projectId, 'board.configure');
  await requireColumnInProject(projectId, columnId);
  await prisma.boardColumn.update({ where: { id: columnId }, data: dto });
  return getBoard(actor, projectId);
}

export async function removeColumn(actor, projectId, columnId) {
  await assertProjectPermission(actor, projectId, 'board.configure');
  await requireColumnInProject(projectId, columnId);

  const taskCount = await prisma.task.count({ where: { columnId, archived: false } });
  if (taskCount > 0) {
    throw conflict('Move or archive the tasks in this column before deleting it');
  }

  await prisma.boardColumn.delete({ where: { id: columnId } });
  return getBoard(actor, projectId);
}

async function requireColumnInProject(projectId, columnId) {
  const column = await prisma.boardColumn.findFirst({
    where: { id: columnId, board: { projectId } },
  });
  if (!column) throw notFound('Column not found on this project board');
  return column;
}
