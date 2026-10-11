// תפקיד הקובץ: חוקי אוטומציה: ניהול החוקים, והמנוע שמפעיל אותם באירוע או בסריקה.
// משתמשים בו: automation-rules.routes.js, tasks.service.js, server.js

// "When X happens, do Y" rules. A rule stores three small JSON tags - trigger, optional
// condition, and action - each shaped { type, label } (plus e.g. userId for ASSIGN_TO_USER).
//
// Triggers:
//   STATUS_ENTERED          event: a task was moved into a REVIEW column
//   ALL_SUBTASKS_COMPLETED  event: the last open subtask of a task was completed
//   TASK_OVERDUE            scan:  a task is past its due date
//   DUE_DATE_APPROACHING    scan:  a task is due within the next 2 days
// Actions:
//   NOTIFY_ASSIGNEE_AND_MANAGER, CREATE_NOTIFICATION, MOVE_TO_COLUMN, ASSIGN_TO_USER
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { notFound } from '../../utils/httpError.js';
import { createNotification } from '../notifications/notifications.service.js';
import { recordStatusChange } from '../tasks/status-history.js';

const DUE_SOON_WINDOW_DAYS = 2;
const TASK_FOR_ACTION_INCLUDE = { project: { select: { organizationId: true, managerId: true } } };

// Prisma needs Prisma.DbNull (not plain null) to clear a nullable Json column.
const jsonOrNull = (value) => (value === null ? Prisma.DbNull : value);

// ---------- CRUD ----------

// שולף את כל החוקים של הארגון.
// נקרא מ: automation-rules.routes.js
export function findForOrganization(organizationId) {
  return prisma.automationRule.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

async function assertProjectInOrg(actor, projectId) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
  });
  if (!project) throw notFound('Project not found in your organization');
}

// יוצר חוק חדש.
// נקרא מ: automation-rules.routes.js
export async function create(actor, dto) {
  await assertProjectInOrg(actor, dto.projectId);
  return prisma.automationRule.create({
    data: {
      organizationId: actor.organizationId,
      projectId: dto.projectId ?? null, // null = applies to every project
      name: dto.name,
      enabled: dto.enabled ?? true,
      trigger: dto.trigger,
      condition: dto.condition ?? undefined,
      action: dto.action,
    },
  });
}

// מעדכן חוק קיים.
// נקרא מ: automation-rules.routes.js
export async function update(actor, ruleId, dto) {
  const rule = await requireRule(actor, ruleId);
  await assertProjectInOrg(actor, dto.projectId);
  return prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      projectId: dto.projectId,
      name: dto.name,
      enabled: dto.enabled,
      trigger: dto.trigger,
      condition: jsonOrNull(dto.condition),
      action: dto.action,
    },
  });
}

// מפעיל או מכבה חוק.
// נקרא מ: automation-rules.routes.js
export async function toggle(actor, ruleId, enabled) {
  const rule = await requireRule(actor, ruleId);
  return prisma.automationRule.update({ where: { id: rule.id }, data: { enabled } });
}

// מוחק חוק.
// נקרא מ: automation-rules.routes.js
export async function remove(actor, ruleId) {
  const rule = await requireRule(actor, ruleId);
  await prisma.automationRule.delete({ where: { id: rule.id } });
  return { deleted: true };
}

// The rule's run history (success / failure per task).
// שולף את היסטוריית ההרצות של חוק.
// נקרא מ: automation-rules.routes.js
export async function executions(actor, ruleId) {
  const rule = await requireRule(actor, ruleId);
  return prisma.automationRuleExecution.findMany({
    where: { ruleId: rule.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

async function requireRule(actor, ruleId) {
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, organizationId: actor.organizationId },
  });
  if (!rule) throw notFound('Automation rule not found');
  return rule;
}

// ---------- Execution engine: event triggers ----------

// Called by tasks.service move() after a card changes column. Fires on every entry into
// the column (each move is its own event, so there is no "fire once" bookkeeping here).
// מפעיל חוקים של "משימה נכנסה לעמודה".
// נקרא מ: tasks.service.js
export async function handleTaskMoved(taskId, newCategory) {
  if (newCategory !== 'REVIEW') return;

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: TASK_FOR_ACTION_INCLUDE });
  if (!task) return;

  const rules = await findMatchingRules(task.project.organizationId, task.projectId, 'STATUS_ENTERED');
  for (const rule of rules) await executeAction(rule, task);
}

// Called by tasks.service move() when a subtask reaches Done.
// מפעיל חוקים של "כל תת-המשימות הושלמו".
// נקרא מ: tasks.service.js
export async function handleSubtaskCompleted(parentTaskId) {
  const parent = await prisma.task.findUnique({
    where: { id: parentTaskId },
    include: { ...TASK_FOR_ACTION_INCLUDE, subtasks: { select: { completedAt: true } } },
  });
  if (!parent || parent.subtasks.length === 0 || parent.subtasks.some((t) => !t.completedAt)) return;

  const rules = await findMatchingRules(parent.project.organizationId, parent.projectId, 'ALL_SUBTASKS_COMPLETED');
  for (const rule of rules) await executeAction(rule, parent);
}

// ---------- Execution engine: scan triggers ----------

// Run every 15 minutes by the scheduler (server.js), and on demand by POST /run-now.
// Each (rule, task) pair fires at most once - recorded in AutomationRuleFiring - so a task
// that stays overdue for days doesn't notify on every scan.
// סריקה תקופתית: חוקים של משימה באיחור ושל מועד מתקרב.
// נקרא מ: automation-rules.routes.js, server.js
export async function runScans(organizationId) {
  let actionsExecuted = 0;

  const overdueRules = await findMatchingRules(organizationId, undefined, 'TASK_OVERDUE');
  for (const rule of overdueRules) {
    actionsExecuted += await fireForTasks(rule, { lt: new Date() });
  }

  const approachingRules = await findMatchingRules(organizationId, undefined, 'DUE_DATE_APPROACHING');
  for (const rule of approachingRules) {
    const now = new Date();
    const soon = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    actionsExecuted += await fireForTasks(rule, { gte: now, lte: soon });
  }

  return { rulesEvaluated: overdueRules.length + approachingRules.length, actionsExecuted };
}

async function fireForTasks(rule, dueDateFilter) {
  const tasks = await prisma.task.findMany({
    where: {
      archived: false,
      completedAt: null,
      dueDate: dueDateFilter,
      project: {
        organizationId: rule.organizationId,
        ...(rule.projectId ? { id: rule.projectId } : {}),
      },
      automationFirings: { none: { ruleId: rule.id } }, // not fired for this task yet
    },
    include: TASK_FOR_ACTION_INCLUDE,
  });
  for (const task of tasks) {
    await executeAction(rule, task);
    await recordFiring(rule.id, task.id);
  }
  return tasks.length;
}

// Enabled rules with this trigger type. A rule with projectId = null applies to all projects.
function findMatchingRules(organizationId, projectId, triggerType) {
  return prisma.automationRule.findMany({
    where: {
      enabled: true,
      ...(organizationId ? { organizationId } : {}),
      ...(projectId ? { OR: [{ projectId: null }, { projectId }] } : {}),
      trigger: { path: ['type'], equals: triggerType }, // query inside the JSON column
    },
  });
}

async function recordFiring(ruleId, taskId) {
  try {
    await prisma.automationRuleFiring.create({ data: { ruleId, taskId } });
  } catch (error) {
    // P2002 = unique constraint: a concurrent scan already recorded this firing. Fine.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
}

// Runs the rule's action and records the outcome. A failing rule never breaks the request
// that triggered it (e.g. moving a card) - the failure is logged in the rule's history.
async function executeAction(rule, task) {
  try {
    await executeActionBody(rule, task);
    await prisma.automationRuleExecution.create({
      data: { ruleId: rule.id, taskId: task.id, status: 'SUCCESS' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.automationRuleExecution.create({
      data: { ruleId: rule.id, taskId: task.id, status: 'FAILED', message },
    });
    console.error(`Automation rule ${rule.id} failed for task ${task.id}: ${message}`);
  }
}

async function executeActionBody(rule, task) {
  switch (rule.action?.type) {
    case 'NOTIFY_ASSIGNEE_AND_MANAGER': {
      const targets = new Set([task.assigneeId, task.project.managerId].filter(Boolean));
      for (const userId of targets) await notifyForTask(rule, task, userId);
      break;
    }
    case 'CREATE_NOTIFICATION': {
      await notifyForTask(rule, task, task.assigneeId ?? task.project.managerId);
      break;
    }
    case 'MOVE_TO_COLUMN': {
      const reviewColumn = await prisma.boardColumn.findFirst({
        where: { category: 'REVIEW', board: { projectId: task.projectId } },
      });
      if (reviewColumn && reviewColumn.id !== task.columnId) {
        const fromColumn = await prisma.boardColumn.findUnique({ where: { id: task.columnId } });
        await prisma.task.update({ where: { id: task.id }, data: { columnId: reviewColumn.id } });
        await recordStatusChange({ taskId: task.id, projectId: task.projectId, fromColumn, toColumn: reviewColumn });
      }
      break;
    }
    case 'ASSIGN_TO_USER': {
      const userId = rule.action.userId;
      if (!userId) throw new Error('ASSIGN_TO_USER requires action.userId');
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId } },
      });
      if (!member) throw new Error('Automation target must be a project member');
      await prisma.task.update({ where: { id: task.id }, data: { assigneeId: userId } });
      await notifyForTask(rule, task, userId);
      break;
    }
    default:
      // Unknown action type - nothing to do.
      break;
  }
}

function notifyForTask(rule, task, userId) {
  return createNotification({
    organizationId: task.project.organizationId,
    userId,
    type: 'AUTOMATION_TRIGGERED',
    title: rule.name,
    body: `Automation rule "${rule.name}" triggered for "${task.title}".`,
    relatedProjectId: task.projectId,
    relatedTaskId: task.id,
  });
}
