// תפקיד הקובץ: לוגיקת המשימות: הרשאות, כללים עסקיים, כתיבה, היסטוריה והתראות.
// משתמשים בו: meetings.routes.js, planning.service.js, tasks.reports.js, tasks.routes.js

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

// כל מה שמסך פרטי המשימה צריך, נטען יחד עם המשימה בשאילתה אחת.
// מה נטען יחד עם משימה: אחראי, תוויות, תלויות, תת-משימות.
// נקרא מ: הקובץ הזה בלבד
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

// משטח את התוצאה של Prisma למבנה שהאתר מצפה לו.
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

// המשימות שהמשתמש רואה: בפרויקטים שגלויים לו (מנהל ארגון: כל הארגון;
// כל השאר: הפרויקטים שהם חברים בהם). מעבירים projectId שכבר נבדק עם
// assertAccessible כדי לצמצם לפרויקט האחד הזה.
// תנאי שאילתה: המשימות שהמשתמש רשאי לראות.
// נקרא מ: הקובץ הזה בלבד
export function taskScope(actor, projectId) {
  return {
    archived: false,
    project: projectId ? { id: projectId, organizationId: actor.organizationId } : visibleProjectsWhere(actor),
  };
}

// המשימות בפרויקטים שהמשתמש מנהל - ההיקף של מסכי הניהול (דשבורד
// ניהולי, עומס צוות, דוחות). מנהל פרויקט רואה שם רק את הפרויקטים שלו.
// תנאי שאילתה: המשימות בפרויקטים שהמשתמש מנהל.
// נקרא מ: tasks.reports.js
export function managedTaskScope(actor, projectId) {
  return {
    archived: false,
    project: projectId ? { id: projectId, organizationId: actor.organizationId } : managedProjectsWhere(actor),
  };
}

// טוען משימה ובודק שהיא שייכת לארגון של המשתמש. משמש גם את התגובות ואת
// הקבצים. משימה מארגון אחר מדווחת כ"לא נמצאה".
// שולף משימה ומוודא שהיא בארגון של המשתמש (אחרת 404).
// נקרא מ: meetings.routes.js
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

// שורה בהיסטוריה של המשימה עצמה (הלשונית Activity במסך פרטי המשימה).
function logActivity(taskId, actorId, action, detail) {
  return prisma.activityEntry.create({ data: { taskId, actorId, action, detail } });
}

async function notifyAssignment(actor, task) {
  if (!task.assigneeId || task.assigneeId === actor.userId) return; // לא שולחים התראה לעצמך
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

// ---------- יצירה, קריאה, עדכון ומחיקה ----------

// יוצר משימה אחרי בדיקת הרשאה, עמודה ואחראי.
// נקרא מ: tasks.routes.js
export async function create(actor, dto) {
  // מותר עם tasks.manage (מנהל הפרויקט) או עם tasks.create (למשל עובד
  // שקיבל אותה כחריג הרשאה). האחרון רשאי לשייך את המשימה רק לעצמו.
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

  // תת-משימות הן ברמה אחת בלבד: משימת האב חייבת להיות משימה ראשית באותו פרויקט.
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

// שולף משימות לפי סינון.
// נקרא מ: tasks.routes.js
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

  // "סטטוס" הוא הקטגוריה של העמודה שבה המשימה נמצאת.
  const columnWhere = {};
  if (query.status) columnWhere.category = query.status;
  if (query.overdue === true) columnWhere.NOT = { category: 'DONE' };
  if (Object.keys(columnWhere).length > 0) where.column = columnWhere;

  const sortBy = query.sortBy ?? 'createdAt';
  const sortDir = query.sortDir ?? 'desc';

  // העדיפות היא enum, והמסד היה ממיין אותה לפי האלפבית (HIGH < LOW <
  // MEDIUM < URGENT), ולכן המיון הזה נעשה ב-JavaScript לפי דירוג.
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

// שולף משימה אחת עם כל הפרטים.
// נקרא מ: tasks.routes.js
export async function findOne(actor, id) {
  const task = await requireTaskInOrg(actor, id);
  await assertAccessible(actor, task.projectId);
  return toDetail(task);
}

// מעדכן את שדות המשימה.
// נקרא מ: planning.service.js, tasks.routes.js
export async function update(actor, id, dto) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      startDate: dto.startDate, // undefined = ללא שינוי, null = ריקון השדה
      dueDate: dto.dueDate,
      estimatedHours: dto.estimatedHours,
      actualHours: dto.actualHours,
      blocked: dto.blocked,
      // מחליפים את כל קבוצת התוויות.
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

// מעביר משימה לארכיון או מחזיר ממנו.
// נקרא מ: planning.service.js, tasks.routes.js
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

// מוחק משימה.
// נקרא מ: tasks.routes.js
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

// שולף את היסטוריית הפעילות של משימה.
// נקרא מ: tasks.routes.js
export async function getActivity(actor, id) {
  const task = await requireTaskInOrg(actor, id);
  await assertAccessible(actor, task.projectId);
  return prisma.activityEntry.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'desc' },
    include: { actor: USER_BRIEF },
  });
}

// ---------- הזזת כרטיס בלוח ה-Kanban ----------

// מעביר משימה לעמודה: הרשאה, מגבלת WIP, חסימות, התראה ואוטומציה.
// נקרא מ: tasks.routes.js
export async function move(actor, id, dto) {
  const task = await requireTaskInOrg(actor, id);
  const project = await assertAccessible(actor, task.projectId);

  // עם tasks.manage (מנהל הפרויקט) מזיזים כל כרטיס; עם tasks.move.own רק את הכרטיסים שלך.
  if (!project.can('tasks.manage')) {
    if (task.assigneeId !== actor.userId) throw forbidden('You can only move tasks assigned to you');
    if (!project.can('tasks.move.own')) throw forbidden('You do not have permission to move tasks');
  }

  // לא סומכים על מזהה עמודה כמו שהוא: העמודה חייבת להיות בלוח של אותו פרויקט.
  const targetColumn = await prisma.boardColumn.findFirst({
    where: { id: dto.columnId, board: { projectId: task.projectId } },
  });
  if (!targetColumn) throw notFound('Column not found on this project board');

  // מגבלת WIP = המספר המרבי של כרטיסים שמותר בעמודה בו-זמנית.
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

  // אי אפשר להשלים משימה כל עוד משימה שחוסמת אותה עדיין פתוחה.
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
      // כניסה ל-Done קובעת את completedAt; יציאה מ-Done מרוקנת אותו.
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

  // חוקי אוטומציה שמופעלים באירוע.
  await handleTaskMoved(id, targetColumn.category);
  if (updated.parentTaskId && willBeDone) {
    await handleSubtaskCompleted(updated.parentTaskId);
  }

  return toDetail(updated);
}

// משייך משימה לעובד ושולח לו התראה.
// נקרא מ: planning.service.js, tasks.routes.js
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

// ---------- תלויות ("משימה א חסומה על ידי משימה ב") ----------

// מוסיף תלות בין שתי משימות.
// נקרא מ: tasks.routes.js
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

  // בדיקת מעגל (חיפוש לעומק): מתחילים מהתלות החדשה ועוקבים אחרי קשרי
  // ה"תלויה ב-" הקיימים. אם מגיעים שוב למשימה הזו, הקשר החדש היה סוגר מעגל
  // (א מחכה ל-ב, ב מחכה ל-א) ואי אפשר היה להשלים אף משימה במעגל.
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

// מסיר תלות בין משימות.
// נקרא מ: tasks.routes.js
export async function removeDependency(actor, id, dependsOnTaskId) {
  const task = await requireTaskInOrg(actor, id);
  await assertProjectPermission(actor, task.projectId, 'tasks.manage');
  await prisma.taskDependency.deleteMany({ where: { taskId: id, dependsOnTaskId } });
  return { deleted: true };
}
