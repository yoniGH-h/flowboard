// מודל התכנון.
// חלקים עיקריים: טעינת מצב הפרויקט, החלת שינויי "מה אם", הערכה (צפי, סיכון, עומס), הנחות.

// מודל התכנון: מצב של פרויקט, שינויי "מה אם" שמוחלים עליו, והתוצאה:
// צפי, סיכון לעיכוב ועומס. משמש את הסימולטור, את ההמלצות ואת
// יומן ההחלטות - כך ששלושתם תמיד מסכימים ביניהם ועם התובנות.
//
// המודל פשוט ושקוף בכוונה. כל תוצאה מפרטת את ההנחות שעליהן היא נשענת.
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { calculateRisk, WORKLOAD_CAPACITY_TASKS } from '../projects/risk.js';

export { WORKLOAD_CAPACITY_TASKS };
// מספר הימים שלפיהם נמדד קצב העבודה (28).
// נקרא מ: הקובץ הזה בלבד
export const PACE_WINDOW_DAYS = 28; // "הקצב הנוכחי" = משימות שהושלמו ב-4 השבועות האחרונים
// מינימום משימות שהושלמו כדי לסמוך על הצפי.
// נקרא מ: הקובץ הזה בלבד
export const MIN_PACE_SAMPLE = 3; // פחות משימות שהושלמו = מעט מדי נתונים לתאריך סיום
const DAY_MS = 86_400_000;

// ---------- טעינה ----------

// כל מה שהמודל צריך על פרויקט אחד, כאובייקטים פשוטים (בלי גישה נוספת למסד).
// טוען מהמסד את כל מה שהמודל צריך על פרויקט.
// נקרא מ: planning.service.js
export async function loadProjectState(actor, projectId, now = new Date()) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
    select: {
      id: true,
      name: true,
      startDate: true,
      targetDate: true,
      progress: true,
      managerId: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) throw notFound('Project not found');

  const [tasks, orgOpenRows, orgUsers, lastMoves] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, archived: false },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        dueDate: true,
        blocked: true,
        completedAt: true,
        priority: true,
        column: { select: { name: true, category: true } },
      },
    }),
    // משימות פתוחות לכל אדם בכל הארגון - מי שעסוק בפרויקט אחר
    // לא באמת פנוי.
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { archived: false, completedAt: null, assigneeId: { not: null }, project: { organizationId: actor.organizationId } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { organizationId: actor.organizationId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, firstName: true, lastName: true, title: true },
    }),
    // מתי כל משימה נכנסה לעמודה הנוכחית שלה? (ה-TaskStatusChange האחרון)
    prisma.taskStatusChange.findMany({
      where: { projectId },
      orderBy: { changedAt: 'desc' },
      distinct: ['taskId'],
      select: { taskId: true, changedAt: true },
    }),
  ]);

  const since = now.getTime() - PACE_WINDOW_DAYS * DAY_MS;
  const enteredColumnAt = new Map(lastMoves.map((m) => [m.taskId, m.changedAt]));

  return {
    now,
    project: {
      id: project.id,
      name: project.name,
      startDate: project.startDate,
      targetDate: project.targetDate,
      progress: project.progress,
      managerId: project.managerId,
    },
    memberIds: new Set(project.members.map((m) => m.userId)),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      assigneeId: t.assigneeId,
      dueDate: t.dueDate,
      blocked: t.blocked,
      completedAt: t.completedAt,
      priority: t.priority,
      columnName: t.column.name,
      columnCategory: t.column.category,
      daysInColumn: enteredColumnAt.has(t.id) ? Math.floor((now - enteredColumnAt.get(t.id)) / DAY_MS) : null,
      deferred: false,
    })),
    doneLast4Weeks: tasks.filter((t) => t.completedAt && t.completedAt.getTime() >= since).length,
    orgOpenByUser: new Map(orgOpenRows.map((r) => [r.assigneeId, r._count._all])),
    users: new Map(orgUsers.map((u) => [u.id, u])),
    paceFactor: 1,
    changes: [],
  };
}

// מחזיר שם מלא של משתמש מתוך המצב.
// נקרא מ: planning.service.js
export const userName = (state, id) => {
  const u = state.users.get(id);
  return u ? `${u.firstName} ${u.lastName}` : 'someone';
};
// האם משימה פתוחה (לא הושלמה ולא נדחתה).
// נקרא מ: planning.service.js
export const isOpen = (t) => !t.completedAt && !t.deferred;
const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- שינויי "מה אם" ----------
//
// changes = {
//   reassign:       [{ taskId, toUserId }]   להעביר משימות פתוחות למישהו אחר
//   deferTaskIds:   [taskId]                 להוציא משימות פתוחות מהגרסה הזו (ארכוב)
//   addMemberIds:   [userId]                 להוסיף אנשים לפרויקט
//   unblockTaskIds: [taskId]                 לסמן משימות חסומות כלא חסומות
//   newTargetDate:  Date                     להזיז את תאריך היעד
// }
//
// מחזיר מצב חדש (המקורי לא משתנה) ותיאורים קריאים של השינויים.
// מחזיר מצב חדש עם השינויים, בלי לגעת במקורי.
// נקרא מ: planning.service.js
export function applyChanges(state, changes) {
  const next = {
    ...state,
    project: { ...state.project },
    memberIds: new Set(state.memberIds),
    tasks: state.tasks.map((t) => ({ ...t })),
    orgOpenByUser: new Map(state.orgOpenByUser),
    changes: [],
  };
  const openTask = (id) => {
    const t = next.tasks.find((x) => x.id === id);
    if (!t || !isOpen(t)) throw badRequest('One of the selected tasks is not an open task of this project');
    return t;
  };

  for (const userId of changes.addMemberIds ?? []) {
    if (!next.users.has(userId)) throw badRequest('One of the selected people is not an active user in your organization');
    if (next.memberIds.has(userId)) throw badRequest(`${userName(next, userId)} is already on this project`);
    next.memberIds.add(userId);
    next.changes.push({ type: 'addMember', userId, text: `Add ${userName(next, userId)} to the project` });
  }
  // הנחה: כל אדם שנוסף מביא את הקצב הממוצע לאדם של הצוות (ראו למטה).
  const added = changes.addMemberIds?.length ?? 0;
  if (added > 0 && state.memberIds.size > 0) next.paceFactor = (state.memberIds.size + added) / state.memberIds.size;

  for (const { taskId, toUserId } of changes.reassign ?? []) {
    const t = openTask(taskId);
    if (!next.memberIds.has(toUserId)) throw badRequest(`${userName(next, toUserId)} is not on this project - add them first`);
    if (t.assigneeId === toUserId) continue;
    const from = t.assigneeId;
    if (from) next.orgOpenByUser.set(from, (next.orgOpenByUser.get(from) ?? 1) - 1);
    next.orgOpenByUser.set(toUserId, (next.orgOpenByUser.get(toUserId) ?? 0) + 1);
    t.assigneeId = toUserId;
    next.changes.push({
      type: 'reassign',
      taskId,
      fromUserId: from,
      toUserId,
      text: `Reassign "${t.title}" ${from ? `from ${userName(next, from)} ` : ''}to ${userName(next, toUserId)}`,
    });
  }

  for (const taskId of changes.deferTaskIds ?? []) {
    const t = openTask(taskId);
    t.deferred = true;
    if (t.assigneeId) next.orgOpenByUser.set(t.assigneeId, (next.orgOpenByUser.get(t.assigneeId) ?? 1) - 1);
    next.changes.push({ type: 'defer', taskId, text: `Defer "${t.title}" (out of this release)` });
  }

  for (const taskId of changes.unblockTaskIds ?? []) {
    const t = openTask(taskId);
    if (!t.blocked) throw badRequest(`"${t.title}" is not blocked`);
    t.blocked = false;
    next.changes.push({ type: 'unblock', taskId, text: `Resolve the blocker on "${t.title}"` });
  }

  if (changes.newTargetDate) {
    if (changes.newTargetDate <= next.project.startDate) throw badRequest('The target date must be after the start date');
    next.project.targetDate = changes.newTargetDate;
    next.changes.push({ type: 'moveTarget', text: `Move the target date to ${shortDate(changes.newTargetDate)}` });
  }

  return next;
}

// ---------- הערכה ----------

// צפי, סיכון לעיכוב ועומס למצב נתון (אמיתי או מדומה).
// מחשב צפי סיום, ציון סיכון ועומס למצב נתון.
// נקרא מ: planning.service.js
export function evaluate(state) {
  const { now, project } = state;
  const open = state.tasks.filter(isOpen);

  const risk = calculateRisk(
    project,
    open.map((t) => ({ assigneeId: t.assigneeId, dueDate: t.dueDate, blocked: t.blocked })),
    state.memberIds.size,
    now,
  );

  // צפי = משימות פתוחות חלקי הקצב של 4 השבועות האחרונים (כפול paceFactor כשמוסיפים אנשים).
  const perDay = (state.doneLast4Weeks / PACE_WINDOW_DAYS) * state.paceFactor;
  let forecast;
  if (open.length === 0) forecast = { status: 'done' };
  else if (state.doneLast4Weeks === 0) forecast = { status: 'stalled' };
  else {
    const finish = new Date(now.getTime() + Math.ceil(open.length / perDay) * DAY_MS);
    const daysLate = Math.round((finish - project.targetDate) / DAY_MS);
    const confident = state.doneLast4Weeks >= MIN_PACE_SAMPLE;
    forecast = {
      status: daysLate > 0 ? (confident ? 'late' : 'slow') : 'on-track',
      weeklyPace: Math.round(perDay * 7 * 10) / 10,
      forecastDate: finish,
      daysLate,
      confident,
    };
  }

  const load = [...state.memberIds]
    .map((userId) => ({
      userId,
      name: userName(state, userId),
      openInProject: open.filter((t) => t.assigneeId === userId).length,
      openTotal: state.orgOpenByUser.get(userId) ?? 0,
    }))
    .sort((a, b) => b.openTotal - a.openTotal);

  return {
    openTasks: open.length,
    targetDate: project.targetDate,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    riskFactors: risk.riskFactors,
    forecast,
    load,
    overCapacity: load.filter((l) => l.openTotal > WORKLOAD_CAPACITY_TASKS).map((l) => l.userId),
  };
}

// ההנחות שמאחורי הסימולציה - מוצגות ליד כל תוצאה.
// מנסח את ההנחות שמאחורי תוצאת הסימולציה.
// נקרא מ: planning.service.js
export function assumptionsFor(state, next) {
  const list = [
    `Pace = tasks completed in the last 4 weeks (${state.doneLast4Weeks}), assumed to continue.`,
    `Someone with more than ${WORKLOAD_CAPACITY_TASKS} open tasks (across all projects) is over capacity.`,
  ];
  if (state.doneLast4Weeks < MIN_PACE_SAMPLE) {
    list.push(`Only ${state.doneLast4Weeks} task(s) completed recently - the finish date is a rough indication, not a forecast.`);
  }
  if (next.paceFactor > 1) {
    list.push('Each added person is assumed to work at the team\'s average pace from day one - in practice onboarding takes time.');
  }
  if (next.changes.some((c) => c.type === 'reassign')) {
    list.push('Reassigning spreads the load; the model does not assume one person works faster than another.');
  }
  return list;
}
