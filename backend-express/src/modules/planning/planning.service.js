// מרכז ההחלטות.
// חלקים עיקריים: תמונת מצב וסימולציה, המלצות, ביצוע החלטה, יומן ההחלטות.

// מרכז ההחלטות: זיהוי בעיה -> המלצה על תיקון -> סימולציה של ההשפעה ->
// ביצוע -> מדידה של מה שקרה בפועל.
//
//   getPlanningView    המצב הנוכחי של הפרויקט, עבור הסימולטור
//   simulate           "מה אם": מעריך שינויים בלי לשמור דבר
//   recommend          הצעות מבוססות כללים, כל אחת כבר עברה סימולציה
//   applyDecision      מבצע את השינויים (דרך ה-services הרגילים של משימות ופרויקטים,
//                      כך שכל בדיקת הרשאה, התראה ורישום ביומן עדיין קורים)
//                      ורושם את ההחלטה
//   listDecisions      יומן ההחלטות, עם ההשפעה של כל החלטה עד כה
import { inTransaction, prisma } from '../../db.js';
import { notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import * as projectsService from '../projects/projects.service.js';
import * as tasksService from '../tasks/tasks.service.js';
import {
  applyChanges,
  assumptionsFor,
  evaluate,
  isOpen,
  loadProjectState,
  userName,
  WORKLOAD_CAPACITY_TASKS,
} from './model.js';

const DAY_MS = 86_400_000;
const STUCK_AFTER_DAYS = 7;
const MAX_RECOMMENDATIONS = 5;

// תכנון פרויקט = ניהול המשימות שלו. (מנהל פרויקט: רק הפרויקטים שלו.)
const requirePlanning = (actor, projectId) => projectsService.assertProjectPermission(actor, projectId, 'tasks.manage');

// החלק של ההערכה שכדאי להציג בהשוואת "לפני ואחרי".
const brief = (e) => ({
  riskScore: e.riskScore,
  riskLevel: e.riskLevel,
  openTasks: e.openTasks,
  targetDate: e.targetDate,
  forecast: e.forecast,
});

// ---------- תמונת מצב וסימולציה ----------

// מחזיר את תמונת המצב של הפרויקט למסך התכנון.
// נקרא מ: planning.routes.js
export async function getPlanningView(actor, projectId) {
  await requirePlanning(actor, projectId);
  const state = await loadProjectState(actor, projectId);
  const open = state.tasks.filter(isOpen);

  return {
    project: state.project,
    evaluation: evaluate(state),
    openTasks: open.map((t) => ({
      id: t.id,
      title: t.title,
      assigneeId: t.assigneeId,
      priority: t.priority,
      blocked: t.blocked,
      dueDate: t.dueDate,
      columnName: t.columnName,
      columnCategory: t.columnCategory,
      daysInColumn: t.daysInColumn,
    })),
    people: [...state.users.values()]
      .map((u) => ({
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        title: u.title,
        isMember: state.memberIds.has(u.id),
        openTotal: state.orgOpenByUser.get(u.id) ?? 0,
        openInProject: open.filter((t) => t.assigneeId === u.id).length,
      }))
      .sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name)),
    capacity: WORKLOAD_CAPACITY_TASKS,
  };
}

// מחשב "לפני ואחרי" לשינויים מוצעים, בלי לשמור.
// נקרא מ: planning.routes.js
export async function simulate(actor, projectId, changes) {
  await requirePlanning(actor, projectId);
  const state = await loadProjectState(actor, projectId);
  const next = applyChanges(state, changes);
  const before = evaluate(state);
  const after = evaluate(next);
  return {
    before,
    after,
    changes: next.changes,
    assumptions: assumptionsFor(state, next),
    loadChanges: loadChanges(before, after),
  };
}

// אנשים שמספר המשימות הפתוחות שלהם משתנה, למשל [{ name: 'Ravi Patel', before: 8, after: 6 }]
function loadChanges(before, after) {
  const beforeBy = new Map(before.load.map((l) => [l.userId, l.openTotal]));
  return after.load
    .map((l) => ({ userId: l.userId, name: l.name, before: beforeBy.get(l.userId) ?? 0, after: l.openTotal }))
    .filter((l) => l.before !== l.after);
}

// ---------- המלצות ----------
//
// כללים פשוטים שאפשר להסביר - כל המלצה אומרת בדיוק למה היא ניתנה:
//   REBALANCE   משימה תקועה (יותר מ-7 ימים בשלב פעיל) או שהאחראי עליה מעל הקיבולת,
//               ולחבר צוות אחר יש הרבה יותר מקום -> מציעים להעביר אותה אליו
//   DEFER       הפרויקט צפוי לאחר ויש משימות בעדיפות LOW שעוד לא התחילו ->
//               מציעים להוציא אותן מהגרסה הזו
//   ADD_MEMBER  הפרויקט צפוי לאחר ולמישהו בארגון יש מקום ->
//               מציעים להוסיף אותו
// כל המלצה עוברת בסימולטור, ולכן מגיעה עם ההשפעה החזויה שלה.
// מציע פעולות לשיפור, כל אחת עם ההשפעה החזויה שלה.
// נקרא מ: planning.routes.js
export async function recommend(actor, projectId) {
  await requirePlanning(actor, projectId);
  const state = await loadProjectState(actor, projectId);
  const base = evaluate(state);
  const recs = [];

  // כל המלצה עומדת בפני עצמה, ולכן ההסבר שלה משתמש בעומסים של היום (loadOf).
  // promised רק זוכר מי כבר הוצע כאחראי חדש, כדי שלא נעמיס
  // את כל ההצעות על אותו אדם.
  const loadOf = (id) => state.orgOpenByUser.get(id) ?? 0;
  const promised = new Map();
  const targetLoad = (id) => loadOf(id) + (promised.get(id) ?? 0);
  const openTasksText = (id) => (loadOf(id) === 0 ? 'no open tasks' : `${loadOf(id)} open task${loadOf(id) === 1 ? '' : 's'}`);

  // --- REBALANCE ---
  const candidates = state.tasks
    .filter(isOpen)
    .filter((t) => t.assigneeId)
    .map((t) => ({
      task: t,
      stuck: ['IN_PROGRESS', 'REVIEW'].includes(t.columnCategory) && (t.daysInColumn ?? 0) >= STUCK_AFTER_DAYS,
      overloaded: loadOf(t.assigneeId) > WORKLOAD_CAPACITY_TASKS,
    }))
    .filter((c) => c.stuck || c.overloaded)
    .sort((a, b) => (b.task.daysInColumn ?? 0) - (a.task.daysInColumn ?? 0));

  for (const { task, stuck } of candidates) {
    if (recs.length >= 3) break;
    const from = task.assigneeId;
    const target = [...state.memberIds]
      .filter((id) => id !== from && state.users.has(id))
      .sort((a, b) => targetLoad(a) - targetLoad(b) || userName(state, a).localeCompare(userName(state, b)))[0];
    // רק כשזה עוזר בבירור: האחראי החדש נשאר הרבה מתחת לקיבולת ונשאר עם
    // פחות משימות מהאחראי הנוכחי.
    if (!target || targetLoad(target) > WORKLOAD_CAPACITY_TASKS - 2 || targetLoad(target) + 2 > loadOf(from)) continue;

    const why = stuck
      ? `"${task.title}" has been in ${task.columnName} for ${task.daysInColumn} days.`
      : `${userName(state, from)} is over capacity (more than ${WORKLOAD_CAPACITY_TASKS} open tasks).`;
    recs.push({
      type: 'REBALANCE',
      title: `Reassign "${task.title}" to ${userName(state, target)}`,
      reason: `${why} ${userName(state, from)} has ${openTasksText(from)}; ${userName(state, target)} has ${openTasksText(target)} and is on this project.`,
      changes: { reassign: [{ taskId: task.id, toUserId: target }] },
    });
    promised.set(target, (promised.get(target) ?? 0) + 1);
  }

  const late = ['late', 'slow'].includes(base.forecast.status);

  // --- DEFER ---
  if (late) {
    const notStartedLow = state.tasks.filter((t) => isOpen(t) && t.priority === 'LOW' && t.columnCategory === 'TODO').slice(0, 5);
    if (notStartedLow.length > 0) {
      recs.push({
        type: 'DEFER',
        title: `Defer ${notStartedLow.length} low-priority task${notStartedLow.length === 1 ? '' : 's'} to a later release`,
        reason: `${state.project.name} is forecast ${base.forecast.daysLate} days late. ${notStartedLow.length === 1 ? 'This low-priority task hasn\'t' : `These ${notStartedLow.length} low-priority tasks haven't`} started yet: ${notStartedLow.map((t) => `"${t.title}"`).join(', ')}.`,
        changes: { deferTaskIds: notStartedLow.map((t) => t.id) },
      });
    }
  }

  // --- ADD_MEMBER ---
  if (late && state.memberIds.size > 0) {
    const free = [...state.users.keys()]
      .filter((id) => !state.memberIds.has(id) && loadOf(id) <= 2)
      .sort((a, b) => loadOf(a) - loadOf(b) || userName(state, a).localeCompare(userName(state, b)))[0];
    if (free) {
      recs.push({
        type: 'ADD_MEMBER',
        title: `Add ${userName(state, free)} to ${state.project.name}`,
        reason: `The project is forecast ${base.forecast.daysLate} days late and ${userName(state, free)} has ${openTasksText(free)} across the organization.`,
        changes: { addMemberIds: [free] },
      });
    }
  }

  // מריצים סימולציה לכל אחת; משאירים רק את אלה שבאמת משפרות משהו.
  return recs
    .map((rec) => {
      const next = applyChanges(state, rec.changes);
      const after = evaluate(next);
      const lc = loadChanges(base, after);
      const improves =
        after.riskScore < base.riskScore ||
        (after.forecast.daysLate ?? 0) < (base.forecast.daysLate ?? 0) ||
        lc.some((l) => l.after < l.before && l.before > WORKLOAD_CAPACITY_TASKS - 1);
      return improves
        ? {
            id: `${rec.type}:${JSON.stringify(rec.changes)}`,
            ...rec,
            before: brief(base),
            after: brief(after),
            loadChanges: lc,
            assumptions: assumptionsFor(state, next),
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, MAX_RECOMMENDATIONS);
}

// ---------- ביצוע החלטה ----------

// מבצע החלטה בפועל בתוך טרנזקציה אחת, ורושם אותה.
// נקרא מ: planning.routes.js
export async function applyDecision(actor, projectId, { changes, note, source }) {
  await requirePlanning(actor, projectId);
  const state = await loadProjectState(actor, projectId);
  const next = applyChanges(state, changes); // מאמת את הכל לפני שמשנים נתונים כלשהם
  const before = evaluate(state);
  const predicted = evaluate(next);

  // הכל או כלום: כל השינויים שלמטה, שורת ה-Decision והרישום ביומן רצים בטרנזקציה
  // אחת. אם שלב כלשהו נכשל (למשל הרשאה, או משימה שהשתנתה
  // בינתיים), הכל מתבטל ולא נשאר מצב חלקי. ההתראות
  // נשלחות לדפדפנים רק אחרי שהטרנזקציה נשמרה (ראו db.js).
  return inTransaction(async () => {
    // נבדק קודם, כך שהחלטה שאסורה נכשלת לפני שנכתב משהו.
    if (changes.addMemberIds?.length) await projectsService.assertProjectPermission(actor, projectId, 'members.manage');
    if (changes.newTargetDate) await projectsService.assertProjectPermission(actor, projectId, 'projects.update');

    // מבצעים דרך ה-services הרגילים: אותן בדיקות, התראות ורישום ביומן כמו
    // בביצוע של כל שלב ביד.
    for (const userId of changes.addMemberIds ?? []) await projectsService.addMember(actor, projectId, { userId });
    for (const { taskId, toUserId } of changes.reassign ?? []) await tasksService.assign(actor, taskId, toUserId);
    for (const taskId of changes.deferTaskIds ?? []) await tasksService.setArchived(actor, taskId, true);
    for (const taskId of changes.unblockTaskIds ?? []) await tasksService.update(actor, taskId, { blocked: false });
    if (changes.newTargetDate) await projectsService.update(actor, projectId, { targetDate: changes.newTargetDate });

    const title = next.changes.length === 1 ? next.changes[0].text : `${next.changes[0].text} + ${next.changes.length - 1} more`;
    const decision = await prisma.decision.create({
      data: {
        organizationId: actor.organizationId,
        projectId,
        actorId: actor.userId,
        source,
        title,
        changes: serializeChanges(changes),
        summary: next.changes.map((c) => c.text),
        note: note?.trim() || null,
        riskBefore: before.riskScore,
        riskPredicted: predicted.riskScore,
        daysLateBefore: before.forecast.daysLate ?? null,
        daysLatePredicted: predicted.forecast.daysLate ?? null,
      },
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'DECISION_APPLIED',
      entityType: 'Project',
      entityId: projectId,
      projectId,
      metadata: { decisionId: decision.id, title, source },
    });

    return decision;
  });
}

const serializeChanges = (changes) => ({
  ...changes,
  ...(changes.newTargetDate ? { newTargetDate: changes.newTargetDate.toISOString() } : {}),
});

// ---------- יומן ההחלטות ----------

// ההחלטות בפרויקטים שהמשתמש מנהל, כל אחת עם ההשפעה שלה עד כה: הסיכון
// והצפי ברגע שהתקבלה, מה המודל חזה, ואיפה הם עכשיו.
// שולף את ההחלטות שבוצעו ומה קרה מאז.
// נקרא מ: planning.routes.js
export async function listDecisions(actor, projectId) {
  if (projectId) await requirePlanning(actor, projectId);
  const decisions = await prisma.decision.findMany({
    where: {
      organizationId: actor.organizationId,
      project: projectsService.managedProjectsWhere(actor),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      project: { select: { id: true, name: true } },
      actor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // המצב הנוכחי של כל פרויקט מעורב (מחושב פעם אחת לכל פרויקט).
  const now = new Date();
  const current = new Map();
  for (const pid of new Set(decisions.map((d) => d.projectId))) {
    try {
      current.set(pid, evaluate(await loadProjectState(actor, pid, now)));
    } catch {
      // הפרויקט כבר לא נגיש - משאירים את ההשפעה שלו ריקה
    }
  }

  return decisions.map((d) => {
    const nowEval = current.get(d.projectId);
    return {
      id: d.id,
      project: d.project,
      actor: d.actor,
      source: d.source,
      title: d.title,
      summary: d.summary,
      note: d.note,
      createdAt: d.createdAt,
      daysAgo: Math.floor((now - d.createdAt) / DAY_MS),
      riskBefore: d.riskBefore,
      riskPredicted: d.riskPredicted,
      riskNow: nowEval?.riskScore ?? null,
      daysLateBefore: d.daysLateBefore,
      daysLatePredicted: d.daysLatePredicted,
      daysLateNow: nowEval?.forecast.daysLate ?? null,
    };
  });
}

// אפשר לרשום החלטה רק על ידי ביצוע שלה, אבל מנהל רשאי להוסיף הערה אחר כך.
// מעדכן את ההערה של החלטה.
// נקרא מ: planning.routes.js
export async function updateDecisionNote(actor, decisionId, note) {
  const decision = await prisma.decision.findFirst({ where: { id: decisionId, organizationId: actor.organizationId } });
  if (!decision) throw notFound('Decision not found');
  await requirePlanning(actor, decision.projectId);
  return prisma.decision.update({ where: { id: decisionId }, data: { note: note?.trim() || null } });
}
