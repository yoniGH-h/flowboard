// תפקיד הקובץ: סיכומים למסכי הניהול: עומס צוות, דשבורד ודוחות.
// משתמשים בו: tasks.routes.js

// סיכומים בצד השרת למסכי הניהול (עומס צוות, דשבורד ניהולי,
// דוחות). הספירה והסיכום נעשים במסד הנתונים (count / groupBy),
// במקום לשלוח כל משימה לדפדפן ולחשב שם.
//
// שלושתם מכסים רק את הפרויקטים שהמשתמש מנהל: מנהל פרויקט רואה את
// הפרויקטים שלו, ומנהל ארגון את כל הארגון.
import { prisma } from '../../db.js';
import { assertProjectPermission } from '../projects/projects.service.js';
import { managedTaskScope } from './tasks.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WEEKS = 8;

// מגמת ההשלמה לדשבורד הניהולי: נקודה לכל שבוע ב-8 השבועות האחרונים,
// לפי התאריכים האמיתיים של המשימות:
//   planned   = אחוז המשימות שהמועד שלהן היה עד סוף אותו שבוע
//   completed = אחוז המשימות שהושלמו בפועל עד סוף אותו שבוע
// כש-"completed" נשאר מתחת ל-"planned", העבודה מפגרת אחרי המועדים.
function buildCompletionTrend(tasks, now) {
  const total = tasks.length;
  const percent = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const points = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i -= 1) {
    const weekEnd = new Date(now.getTime() - i * 7 * DAY_MS);
    points.push({
      label: i === 0 ? 'This week' : `${i}w ago`,
      planned: percent(tasks.filter((t) => t.dueDate && t.dueDate <= weekEnd).length),
      completed: percent(tasks.filter((t) => t.completedAt && t.completedAt <= weekEnd).length),
    });
  }
  return points;
}

// דוח על פרויקט מסוים דורש לנהל את הפרויקט הזה.
async function assertManagedProject(actor, projectId) {
  if (projectId) await assertProjectPermission(actor, projectId, 'tasks.manage');
}

// עומס צוות: לכל אחראי - משימות פתוחות, משימות באיחור ושעות מוערכות.
// מחשב לכל עובד משימות פתוחות, איחורים ושעות.
// נקרא מ: tasks.routes.js
export async function getWorkloadSummary(actor, projectId) {
  await assertManagedProject(actor, projectId);

  const baseWhere = {
    ...managedTaskScope(actor, projectId),
    completedAt: null,
    assigneeId: { not: null },
  };

  const [openRows, overdueRows] = await Promise.all([
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { estimatedHours: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { ...baseWhere, dueDate: { lt: new Date() } },
      _count: { _all: true },
    }),
  ]);

  const overdueByUser = new Map(overdueRows.map((r) => [r.assigneeId, r._count._all]));

  return openRows.map((r) => ({
    userId: r.assigneeId,
    openCount: r._count._all,
    overdueCount: overdueByUser.get(r.assigneeId) ?? 0,
    estimatedHours: r._sum.estimatedHours ?? 0,
  }));
}

// דשבורד ניהולי: ספירה לפי סטטוס, ההשלמה של השבוע, מגמת ההשלמה
// והמשימות בעדיפות הגבוהה ביותר.
// מחשב את נתוני הדשבורד הניהולי, כולל גרף ההתקדמות.
// נקרא מ: tasks.routes.js
export async function getDashboardSummary(actor, projectId) {
  await assertManagedProject(actor, projectId);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const scope = managedTaskScope(actor, projectId);
  const count = (extra) => prisma.task.count({ where: { ...scope, ...extra } });

  const [
    total,
    done,
    blocked,
    overdue,
    overdueExclBlocked,
    weeklyTotal,
    weeklyCompleted,
    oldestOverdueTask,
    exampleBlockedTask,
    priorityTasks,
    taskDates,
  ] = await Promise.all([
    count({}),
    count({ completedAt: { not: null } }),
    count({ completedAt: null, blocked: true }),
    count({ completedAt: null, dueDate: { lt: now } }),
    count({ completedAt: null, blocked: false, dueDate: { lt: now } }),
    count({ dueDate: { gte: weekAgo, lte: now } }),
    count({ dueDate: { gte: weekAgo, lte: now }, completedAt: { not: null } }),
    prisma.task.findFirst({
      where: { ...scope, completedAt: null, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' },
      select: { title: true },
    }),
    prisma.task.findFirst({
      where: { ...scope, completedAt: null, blocked: true },
      select: { title: true },
    }),
    // מבקשים רק URGENT ו-HIGH, ומיון ה-enum בסדר 'desc' שם במקרה את URGENT
    // לפני HIGH (U אחרי H באלפבית). לא להוסיף כאן עדיפויות נוספות בלי לעבור
    // לדירוג מפורש כמו PRIORITY_RANK בקובץ tasks.service.js.
    prisma.task.findMany({
      where: { ...scope, completedAt: null, priority: { in: ['URGENT', 'HIGH'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        projectId: true,
        priority: true,
        dueDate: true,
        assigneeId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.task.findMany({ where: scope, select: { dueDate: true, completedAt: true } }),
  ]);

  return {
    total,
    open: total - done,
    done,
    blocked,
    overdue,
    overdueExclBlocked,
    inProgress: Math.max(total - done - blocked - overdueExclBlocked, 0),
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    weekly: {
      completed: weeklyCompleted,
      total: weeklyTotal,
      percent: weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0,
    },
    completionTrend: buildCompletionTrend(taskDates, now),
    oldestOverdueTitle: oldestOverdueTask?.title ?? null,
    exampleBlockedTitle: exampleBlockedTask?.title ?? null,
    priorityTasks: priorityTasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: t.project.name,
      priority: t.priority,
      dueDate: t.dueDate,
      assigneeId: t.assigneeId,
    })),
  };
}

// דוחות. שני היקפים בכוונה: מספרי המדדים מושפעים מהסינון לפי אחראי
// ולפי טווח תאריכים, ואילו userActivity מכסה תמיד את כל הפרויקטים שבהיקף (המספרים
// הכוללים של כל חבר צוות), וזה מה שמוצג בטבלה "User activity report".
// מחשב את נתוני מסך הדוחות לפי הסינון.
// נקרא מ: tasks.routes.js
export async function getReportsSummary(actor, filters) {
  await assertManagedProject(actor, filters.projectId);

  const now = new Date();
  const projectScope = managedTaskScope(actor, filters.projectId);
  const cutoff = filters.days && filters.days > 0 ? new Date(now.getTime() - filters.days * DAY_MS) : null;

  const scoped = {
    ...projectScope,
    assigneeId: filters.assigneeId === 'me' ? actor.userId : filters.assigneeId,
    ...(cutoff ? { OR: [{ createdAt: { gte: cutoff } }, { completedAt: { gte: cutoff } }] } : {}),
  };

  const [total, overdue, completedRows, assignedRows, completedByUserRows] = await Promise.all([
    prisma.task.count({ where: scoped }),
    prisma.task.count({ where: { ...scoped, completedAt: null, dueDate: { lt: now } } }),
    prisma.task.findMany({
      where: { ...scoped, completedAt: { not: null } },
      select: { createdAt: true, completedAt: true, dueDate: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { ...projectScope, assigneeId: { not: null } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { ...projectScope, assigneeId: { not: null }, completedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const completed = completedRows.length;
  const totalDays = completedRows.reduce(
    (sum, t) => sum + Math.max(0, Math.round((t.completedAt - t.createdAt) / DAY_MS)),
    0,
  );
  const onTimeCount = completedRows.filter((t) => !t.dueDate || t.completedAt <= t.dueDate).length;

  const completedByUser = new Map(completedByUserRows.map((r) => [r.assigneeId, r._count._all]));
  const userActivity = assignedRows
    .map((r) => {
      const assigned = r._count._all;
      const userCompleted = completedByUser.get(r.assigneeId) ?? 0;
      return {
        userId: r.assigneeId,
        assigned,
        completed: userCompleted,
        rate: assigned > 0 ? Math.round((userCompleted / assigned) * 100) : 0,
      };
    })
    .sort((a, b) => b.assigned - a.assigned);

  return {
    total,
    completed,
    overdue,
    avgCompletionDays: completed > 0 ? Math.round(totalDays / completed) : 0,
    onTimeRate: completed > 0 ? Math.round((onTimeCount / completed) * 100) : 0,
    userActivity,
  };
}
