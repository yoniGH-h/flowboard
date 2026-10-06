// The planning model: a project's state, what-if changes applied to it, and the resulting
// forecast / delay risk / workload. Used by the what-if simulator, the recommendations, and
// the decision log - so all three always agree with each other and with Insights.
//
// It is deliberately simple and transparent. Every result lists the assumptions it made.
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { calculateRisk, WORKLOAD_CAPACITY_TASKS } from '../projects/risk.js';

export { WORKLOAD_CAPACITY_TASKS };
export const PACE_WINDOW_DAYS = 28; // "current pace" = tasks completed in the last 4 weeks
export const MIN_PACE_SAMPLE = 3; // fewer completed tasks = too little data for a finish date
const DAY_MS = 86_400_000;

// ---------- Loading ----------

// Everything the model needs about one project, in plain objects (no further DB access).
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
    // Open tasks per person across the WHOLE organization - someone busy on another project
    // is not really free.
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { archived: false, completedAt: null, assigneeId: { not: null }, project: { organizationId: actor.organizationId } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { organizationId: actor.organizationId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, firstName: true, lastName: true, title: true },
    }),
    // When did each task enter its current column? (the latest TaskStatusChange)
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

export const userName = (state, id) => {
  const u = state.users.get(id);
  return u ? `${u.firstName} ${u.lastName}` : 'someone';
};
export const isOpen = (t) => !t.completedAt && !t.deferred;
const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- What-if changes ----------
//
// changes = {
//   reassign:       [{ taskId, toUserId }]   give open tasks to someone else
//   deferTaskIds:   [taskId]                 take open tasks out of this release (archived)
//   addMemberIds:   [userId]                 add people to the project
//   unblockTaskIds: [taskId]                 mark blocked tasks as unblocked
//   newTargetDate:  Date                     move the target date
// }
//
// Returns a NEW state (the original is untouched) plus human-readable descriptions.
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
  // Assumption: every added person brings the team's average per-person pace (see below).
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

// ---------- Evaluation ----------

// Forecast, delay risk and workload for a state (real or simulated).
export function evaluate(state) {
  const { now, project } = state;
  const open = state.tasks.filter(isOpen);

  const risk = calculateRisk(
    project,
    open.map((t) => ({ assigneeId: t.assigneeId, dueDate: t.dueDate, blocked: t.blocked })),
    state.memberIds.size,
    now,
  );

  // Forecast = open tasks / pace of the last 4 weeks (x paceFactor when people are added).
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

// The assumptions behind a simulation - shown next to every result.
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
