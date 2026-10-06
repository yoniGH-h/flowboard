import { prisma } from '../../db.js';
import { conflict, forbidden, notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import { handleSubtaskCompleted, handleTaskMoved } from '../automation-rules/automation-rules.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { recordStatusChange } from './status-history.js';
import {
  assertAccessible,
  assertProjectPermission,
  managedProjectsWhere,
  visibleProjectsWhere,
} from '../projects/projects.service.js';

const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };

const USER_BRIEF = { select: { id: true, firstName: true, lastName: true, avatarColor: true } };

// Everything the Task Details screen needs, loaded with the task in one query.
export const TASK_INCLUDE = {
  assignee: USER_BRIEF,
  creator: USER_BRIEF,
  labels: { include: { label: true } },
  column: { select: { id: true, name: true, category: true, boardId: true } },
  dependsOn: true,
  dependedOnBy: true,
  parentTask: { select: { id: true, title: true } },
  subtasks: {
    select: { id: true, title: true, completedAt: true, columnId: true },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { comments: true, attachments: true } },
};

// Flattens the Prisma result into the shape the frontend expects.
function toDetail(task) {
  const { labels, dependsOn, _count, ...rest } = task;
  return {
    ...rest,
    labels: labels.map((l) => l.label),
    dependsOnTaskIds: dependsOn.map((d) => d.dependsOnTaskId),
    commentCount: _count.comments,
    attachmentCount: _count.attachments,
  };
}

// Tasks visible to the actor: in projects they can see (Org Admins: the whole organization;
// everyone else: projects they belong to). Pass a projectId that was already checked with
// assertAccessible to narrow it to that one project.
export function taskScope(actor, projectId) {
  return {
    archived: false,
    project: projectId ? { id: projectId, organizationId: actor.organizationId } : visibleProjectsWhere(actor),
  };
}

// Tasks in the projects the actor manages - the scope of the management screens (Management
// Dashboard, Team Workload, Reports). A Project Manager sees only their own projects there.
export function managedTaskScope(actor, projectId) {
  return {
    archived: false,
    project: projectId ? { id: projectId, organizationId: actor.organizationId } : managedProjectsWhere(actor),
  };
}

// Loads a task and checks it belongs to the actor's organization. Used by Comments and
// Attachments too. A task from another organization is reported as "not found".
export async function requireTaskInOrg(actor, id) {
  const task = await prisma.task.findFirst({
    where: { id, project: { organizationId: actor.organizationId } },
    include: TASK_INCLUDE,
  });
  if (!task) throw notFound('Task not found');
  return task;
}

async function requireProjectMember(projectId, userId) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw notFound('Selected assignee is not a member of this project');
}

// A row in the task's own history (the Activity tab on Task Details).
function logActivity(taskId, actorId, action, detail) {
  return prisma.activityEntry.create({ data: { taskId, actorId, action, detail } });
}

async function notifyAssignment(actor, task) {
  if (!task.assigneeId || task.assigneeId === actor.userId) return; // don't notify yourself
  await createNotification({
    organizationId: actor.organizationId,
    userId: task.assigneeId,
    type: 'TASK_ASSIGNED',
    title: 'Task assigned to you',
    body: `You were assigned "${task.title}".`,
    relatedProjectId: task.projectId,
    relatedTaskId: task.id,
  });
}

// ---------- CRUD ----------

export async function create(actor, dto) {
  // Allowed with tasks.manage (the project's manager) or tasks.create (e.g. an employee who
  // got it as a permission exception). The latter may only assign the task to themselves.
  const project = await assertAccessible(actor, dto.projectId);
  const managesTasks = project.can('tasks.manage');
  if (!managesTasks && !project.can('tasks.create')) {
    throw forbidden('You do not have permission to create tasks in this project');
  }
  if (!managesTasks && dto.assigneeId && dto.assigneeId !== actor.userId) {
    throw forbidden('You can only assign tasks you create to yourself');
  }

  const column = await prisma.boardColumn.findFirst({
    where: { id: dto.columnId, board: { projectId: dto.projectId } },
  });
  if (!column) throw notFound('Column not found on this project board');

  if (dto.assigneeId) await requireProjectMember(dto.projectId, dto.assigneeId);

  // Subtasks are one level deep: the parent must be a top-level task in the same project.
  if (dto.parentTaskId) {
    const parent = await prisma.task.findFirst({
      where: { id: dto.parentTaskId, projectId: dto.projectId, parentTaskId: null },
    });
    if (!parent) throw notFound('Parent task not found in this project');
  }

  const task = await prisma.task.create({
    data: {
      projectId: dto.projectId,
      columnId: dto.columnId,
      title: dto.title,
      description: dto.description ?? '',
      assigneeId: dto.assigneeId,
      creatorId: actor.userId,
      priority: dto.priority ?? 'MEDIUM',
      startDate: dto.startDate ?? null,
      dueDate: dto.dueDate ?? null,
      estimatedHours: dto.estimatedHours,
      parentTaskId: dto.parentTaskId,
      labels: dto.labelIds ? { create: dto.labelIds.map((labelId) => ({ labelId })) } : undefined,
    },
    include: TASK_INCLUDE,
  });

  await logActivity(task.id, actor.userId, 'TASK_CREATED', `Created task "${task.title}"`);
  await recordStatusChange({ taskId: task.id, projectId: task.projectId, fromColumn: null, toColumn: column, actorId: actor.userId });
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'TASK_CREATED',
    entityType: 'Task',
    entityId: task.id,
    projectId: dto.projectId,
    taskId: task.id,
  });
  if (dto.assigneeId) await notifyAssignment(actor, task);

  return toDetail(task);
}

export async function findAll(actor, query) {
  if (query.projectId) await assertAccessible(actor, query.projectId);

  const now = new Date();
  const where = {
    ...taskScope(actor, query.projectId),
    assigneeId: query.assigneeId === 'me' ? actor.userId : query.assigneeId,
    priority: query.priority,
    blocked: query.blocked,
    dueDate: query.overdue === true ? { lt: now } : query.overdue === false ? { gte: now } : undefined,
    OR: query.search
      ? [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ]
      : undefined,
  };

  // "Status" is the category of the column the task sits in.
  const columnWhere = {};
  if (query.status) columnWhere.category = query.status;
  if (query.overdue === true) columnWhere.NOT = { category: 'DONE' };
  if (Object.keys(columnWhere).length > 0) where.column = columnWhere;

  const sortBy = query.sortBy ?? 'createdAt';
  const sortDir = query.sortDir ?? 'desc';

  // Priority is an enum, and the database would sort it alphabetically (HIGH < LOW <
  // MEDIUM < URGENT), so this one sort is done in JavaScript by rank.
  if (sortBy === 'priority') {
    const all = await prisma.task.findMany({ where, include: TASK_INCLUDE });
    all.sort((a, b) => {
      const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return sortDir === 'asc' ? diff : -diff;
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: all.slice(start, start + query.pageSize).map(toDetail),
      total: all.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { [sortBy]: sortDir },
      skip: query.cursor ? 1 : (query.page - 1) * query.pageSize,
      take: query.pageSize,
      cursor: query.cursor ? { id: query.cursor } : undefined,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    items: items.map(toDetail),
    total,
    page: query.page,
    pageSize: query.pageSize,
    nextCursor: items.length === query.pageSize ? items.at(-1)?.id : null,
  };
}

export async function findOne(actor, id) {
  const task = await requireTaskInOrg(actor, id);
  await assertAccessible(actor, task.projectId);
  return toDetail(task);
}

export async function update(actor, id, dto) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      startDate: dto.startDate, // undefined = unchanged, null = cleared
      dueDate: dto.dueDate,
      estimatedHours: dto.estimatedHours,
      actualHours: dto.actualHours,
      blocked: dto.blocked,
      // Replace the whole label set.
      labels: dto.labelIds
        ? { deleteMany: {}, create: dto.labelIds.map((labelId) => ({ labelId })) }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  const fields = Object.keys(dto);
  await logActivity(id, actor.userId, 'TASK_UPDATED', `Updated fields: ${fields.join(', ')}`);
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'TASK_UPDATED',
    entityType: 'Task',
    entityId: id,
    projectId: task.projectId,
    taskId: id,
    metadata: { fields },
  });

  return toDetail(updated);
}

export async function setArchived(actor, id, archived) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');

  const updated = await prisma.task.update({ where: { id }, data: { archived }, include: TASK_INCLUDE });
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: archived ? 'TASK_ARCHIVED' : 'TASK_UNARCHIVED',
    entityType: 'Task',
    entityId: id,
    projectId: task.projectId,
    taskId: id,
  });

  return toDetail(updated);
}

export async function remove(actor, id) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');

  await prisma.task.delete({ where: { id } });
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'TASK_DELETED',
    entityType: 'Task',
    entityId: id,
    projectId: task.projectId,
    metadata: { title: task.title },
  });
}

export async function getActivity(actor, id) {
  const task = await requireTaskInOrg(actor, id);
  await assertAccessible(actor, task.projectId);
  return prisma.activityEntry.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'desc' },
    include: { actor: USER_BRIEF },
  });
}

// ---------- Moving a card on the Kanban board ----------

export async function move(actor, id, dto) {
  const task = await requireTaskInOrg(actor, id);
  const project = await assertAccessible(actor, task.projectId);

  // tasks.manage (the project's manager) moves any card; tasks.move.own only your own cards.
  if (!project.can('tasks.manage')) {
    if (task.assigneeId !== actor.userId) throw forbidden('You can only move tasks assigned to you');
    if (!project.can('tasks.move.own')) throw forbidden('You do not have permission to move tasks');
  }

  // Never trust a bare column id: it must be on this same project's board.
  const targetColumn = await prisma.boardColumn.findFirst({
    where: { id: dto.columnId, board: { projectId: task.projectId } },
  });
  if (!targetColumn) throw notFound('Column not found on this project board');

  // WIP limit = the maximum number of cards allowed in the column at once.
  if (targetColumn.wipLimit) {
    const currentCount = await prisma.task.count({
      where: { columnId: targetColumn.id, archived: false, id: { not: id } },
    });
    if (currentCount >= targetColumn.wipLimit) {
      throw conflict(`"${targetColumn.name}" is at its WIP limit (${targetColumn.wipLimit})`);
    }
  }

  const wasDone = task.column.category === 'DONE';
  const willBeDone = targetColumn.category === 'DONE';

  // A task can't be completed while a task that blocks it is still open.
  if (willBeDone) {
    const unfinishedBlockers = await prisma.taskDependency.count({
      where: { taskId: id, type: 'BLOCKS', dependsOnTask: { completedAt: null } },
    });
    if (unfinishedBlockers > 0) {
      throw conflict('Complete all blocking dependencies before completing this task');
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      columnId: dto.columnId,
      // Entering Done stamps completedAt; leaving Done clears it.
      completedAt: willBeDone && !wasDone ? new Date() : !willBeDone ? null : undefined,
    },
    include: TASK_INCLUDE,
  });

  await logActivity(id, actor.userId, 'TASK_STATUS_CHANGED', `Moved from "${task.column.name}" to "${targetColumn.name}"`);
  if (task.columnId !== targetColumn.id) {
    await recordStatusChange({ taskId: id, projectId: task.projectId, fromColumn: task.column, toColumn: targetColumn, actorId: actor.userId });
  }
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'TASK_STATUS_CHANGED',
    entityType: 'Task',
    entityId: id,
    projectId: task.projectId,
    taskId: id,
    metadata: { from: task.column.name, to: targetColumn.name },
  });

  if (task.assigneeId && task.assigneeId !== actor.userId) {
    await createNotification({
      organizationId: actor.organizationId,
      userId: task.assigneeId,
      type: 'STATUS_CHANGED',
      title: 'Task moved',
      body: `"${task.title}" moved to ${targetColumn.name}.`,
      relatedProjectId: task.projectId,
      relatedTaskId: id,
    });
  }

  // Event-driven automation rules.
  await handleTaskMoved(id, targetColumn.category);
  if (updated.parentTaskId && willBeDone) {
    await handleSubtaskCompleted(updated.parentTaskId);
  }

  return toDetail(updated);
}

export async function assign(actor, id, assigneeId) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');

  if (assigneeId) await requireProjectMember(task.projectId, assigneeId);

  const updated = await prisma.task.update({
    where: { id },
    data: { assigneeId: assigneeId ?? null },
    include: TASK_INCLUDE,
  });

  await logActivity(
    id,
    actor.userId,
    'TASK_ASSIGNED',
    assigneeId ? `Assigned to ${updated.assignee?.firstName} ${updated.assignee?.lastName}` : 'Unassigned',
  );
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'TASK_ASSIGNED',
    entityType: 'Task',
    entityId: id,
    projectId: task.projectId,
    taskId: id,
    metadata: { assigneeId: assigneeId ?? null },
  });
  if (assigneeId) await notifyAssignment(actor, updated);

  return toDetail(updated);
}

// ---------- Dependencies ("task A is blocked by task B") ----------

export async function addDependency(actor, id, dto) {
  if (id === dto.dependsOnTaskId) throw conflict('A task cannot depend on itself');

  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');

  const dependency = await prisma.task.findFirst({
    where: { id: dto.dependsOnTaskId, projectId: task.projectId },
  });
  if (!dependency) throw notFound('Dependency task not found in this project');

  const edges = await prisma.taskDependency.findMany({
    where: { task: { projectId: task.projectId } },
    select: { taskId: true, dependsOnTaskId: true },
  });
  if (edges.some((e) => e.taskId === id && e.dependsOnTaskId === dto.dependsOnTaskId)) {
    throw conflict('This dependency already exists');
  }

  // Cycle check (depth-first search): starting from the new dependency, follow the existing
  // "depends on" edges. If we can reach this task again, the new edge would close a loop
  // (A waits for B, B waits for A) and nothing in the loop could ever be completed.
  const graph = new Map();
  for (const e of edges) {
    graph.set(e.taskId, [...(graph.get(e.taskId) ?? []), e.dependsOnTaskId]);
  }
  const pending = [dto.dependsOnTaskId];
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (current === id) throw conflict('This dependency would create a cycle');
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(graph.get(current) ?? []));
  }

  return prisma.taskDependency.create({
    data: { taskId: id, dependsOnTaskId: dto.dependsOnTaskId, type: dto.type ?? 'BLOCKS' },
  });
}

export async function removeDependency(actor, id, dependsOnTaskId) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');
  await prisma.taskDependency.deleteMany({ where: { taskId: id, dependsOnTaskId } });
  return { deleted: true };
}
