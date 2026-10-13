// חוקי האוטומציה והמנוע שמריץ אותם.
// חלקים עיקריים: ניהול החוקים, הפעלה באירוע, הפעלה בסריקה, ביצוע הפעולה.

// חוקים מסוג "כש-X קורה, עשה Y". חוק שומר שלושה אובייקטי JSON קטנים - trigger, condition
// (אופציונלי) ו-action - כל אחד במבנה { type, label } (ועוד למשל userId עבור ASSIGN_TO_USER).
//
// טריגרים:
//   STATUS_ENTERED          אירוע: משימה הועברה לעמודה מסוג REVIEW
//   ALL_SUBTASKS_COMPLETED  אירוע: תת-המשימה הפתוחה האחרונה של משימה הושלמה
//   TASK_OVERDUE            סריקה: משימה עברה את המועד שלה
//   DUE_DATE_APPROACHING    סריקה: המועד של משימה בתוך יומיים
// פעולות:
//   NOTIFY_ASSIGNEE_AND_MANAGER, CREATE_NOTIFICATION, MOVE_TO_COLUMN, ASSIGN_TO_USER
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { notFound } from '../../utils/httpError.js';
import { createNotification } from '../notifications/notifications.service.js';
import { recordStatusChange } from '../tasks/status-history.js';

const DUE_SOON_WINDOW_DAYS = 2;
const TASK_FOR_ACTION_INCLUDE = { project: { select: { organizationId: true, managerId: true } } };

// ממיר null לערך ש-Prisma דורש לעמודת JSON.
const jsonOrNull = (value) => (value === null ? Prisma.DbNull : value);

// ---------- יצירה, קריאה, עדכון ומחיקה ----------

// שולף את כל החוקים של הארגון.
export function findForOrganization(organizationId) {
  return prisma.automationRule.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

// מוודא שהפרויקט שייך לארגון.
async function assertProjectInOrg(actor, projectId) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
  });
  if (!project) throw notFound('Project not found in your organization');
}

// יוצר חוק חדש.
export async function create(actor, dto) {
  await assertProjectInOrg(actor, dto.projectId);
  return prisma.automationRule.create({
    data: {
      organizationId: actor.organizationId,
      projectId: dto.projectId ?? null, // null = חל על כל הפרויקטים
      name: dto.name,
      enabled: dto.enabled ?? true,
      trigger: dto.trigger,
      condition: dto.condition ?? undefined,
      action: dto.action,
    },
  });
}

// מעדכן חוק קיים.
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
export async function toggle(actor, ruleId, enabled) {
  const rule = await requireRule(actor, ruleId);
  return prisma.automationRule.update({ where: { id: rule.id }, data: { enabled } });
}

// מוחק חוק.
export async function remove(actor, ruleId) {
  const rule = await requireRule(actor, ruleId);
  await prisma.automationRule.delete({ where: { id: rule.id } });
  return { deleted: true };
}

// שולף את היסטוריית ההרצות של חוק.
export async function executions(actor, ruleId) {
  const rule = await requireRule(actor, ruleId);
  return prisma.automationRuleExecution.findMany({
    where: { ruleId: rule.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

// שולף חוק ומוודא שהוא בארגון של המשתמש.
async function requireRule(actor, ruleId) {
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, organizationId: actor.organizationId },
  });
  if (!rule) throw notFound('Automation rule not found');
  return rule;
}

// ---------- מנוע ההרצה: טריגרים של אירוע ----------

// מפעיל חוקים של "משימה נכנסה לעמודה".
export async function handleTaskMoved(taskId, newCategory) {
  if (newCategory !== 'REVIEW') return;

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: TASK_FOR_ACTION_INCLUDE });
  if (!task) return;

  const rules = await findMatchingRules(task.project.organizationId, task.projectId, 'STATUS_ENTERED');
  for (const rule of rules) await executeAction(rule, task);
}

// מפעיל חוקים של "כל תת-המשימות הושלמו".
export async function handleSubtaskCompleted(parentTaskId) {
  const parent = await prisma.task.findUnique({
    where: { id: parentTaskId },
    include: { ...TASK_FOR_ACTION_INCLUDE, subtasks: { select: { completedAt: true } } },
  });
  if (!parent || parent.subtasks.length === 0 || parent.subtasks.some((t) => !t.completedAt)) return;

  const rules = await findMatchingRules(parent.project.organizationId, parent.projectId, 'ALL_SUBTASKS_COMPLETED');
  for (const rule of rules) await executeAction(rule, parent);
}

// ---------- מנוע ההרצה: טריגרים של סריקה ----------

// סריקה תקופתית: חוקים של משימה באיחור ושל מועד מתקרב.
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

// מריץ חוק על המשימות המתאימות שעוד לא רץ עליהן.
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
      automationFirings: { none: { ruleId: rule.id } }, // החוק עוד לא רץ על המשימה הזו
    },
    include: TASK_FOR_ACTION_INCLUDE,
  });
  for (const task of tasks) {
    await executeAction(rule, task);
    await recordFiring(rule.id, task.id);
  }
  return tasks.length;
}

// מוצא חוקים פעילים לפי סוג הטריגר.
function findMatchingRules(organizationId, projectId, triggerType) {
  return prisma.automationRule.findMany({
    where: {
      enabled: true,
      ...(organizationId ? { organizationId } : {}),
      ...(projectId ? { OR: [{ projectId: null }, { projectId }] } : {}),
      trigger: { path: ['type'], equals: triggerType }, // שאילתה בתוך עמודת ה-JSON
    },
  });
}

// רושם שהחוק רץ על המשימה.
async function recordFiring(ruleId, taskId) {
  try {
    await prisma.automationRuleFiring.create({ data: { ruleId, taskId } });
  } catch (error) {
    // P2002 = אילוץ ייחודיות: סריקה מקבילה כבר רשמה את ההרצה הזו. תקין.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
}

// מריץ את פעולת החוק ורושם הצלחה או כישלון.
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

// מבצע את הפעולה לפי הסוג שלה.
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
      // סוג פעולה לא מוכר - אין מה לעשות.
      break;
  }
}

// שולח התראה של חוק אוטומציה.
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
