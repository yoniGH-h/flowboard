// The Decision Center: detect a problem -> recommend a fix -> simulate its effect ->
// apply it -> measure what actually happened.
//
//   getPlanningView    the project's current state, for the simulator
//   simulate           what-if: evaluate changes WITHOUT saving anything
//   recommend          rule-based suggestions, each already simulated
//   applyDecision      carry out the changes (through the normal task / project services,
//                      so every permission check, notification and audit entry still happens)
//                      and record the decision
//   listDecisions      the decision log, with each decision's effect so far
import { prisma } from '../../db.js';
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

// Planning a project = managing its tasks. (A Project Manager: only their own projects.)
const requirePlanning = (actor, projectId) => projectsService.assertProjectPermission(actor, projectId, 'tasks.manage');

// The part of an evaluation worth showing in a before/after comparison.
const brief = (e) => ({
  riskScore: e.riskScore,
  riskLevel: e.riskLevel,
  openTasks: e.openTasks,
  targetDate: e.targetDate,
  forecast: e.forecast,
});

// ---------- View + simulation ----------

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

// People whose open-task count changes, e.g. [{ name: 'Ravi Patel', before: 8, after: 6 }]
function loadChanges(before, after) {
  const beforeBy = new Map(before.load.map((l) => [l.userId, l.openTotal]));
  return after.load
    .map((l) => ({ userId: l.userId, name: l.name, before: beforeBy.get(l.userId) ?? 0, after: l.openTotal }))
    .filter((l) => l.before !== l.after);
}

// ---------- Recommendations ----------
//
// Simple, explainable rules - every recommendation says exactly why it was made:
//   REBALANCE   a task is stuck (>7 days in an active stage) or its owner is over capacity,
//               and a project member has clearly more room -> suggest reassigning it
//   DEFER       the project is forecast late and some LOW-priority tasks haven't started ->
//               suggest moving them out of this release
//   ADD_MEMBER  the project is forecast late and someone in the organization has room ->
//               suggest adding them
// Each one is run through the simulator, so it comes with its predicted effect.
export async function recommend(actor, projectId) {
  await requirePlanning(actor, projectId);
  const state = await loadProjectState(actor, projectId);
  const base = evaluate(state);
  const recs = [];

  // Each recommendation stands on its own, so its explanation uses today's loads (loadOf).
  // `promised` only remembers who was already suggested as a new owner, so we don't pile
  // every suggestion onto the same person.
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
    // Only when it clearly helps: the new owner stays well under capacity and ends up with
    // fewer tasks than the current owner.
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

  // Simulate each one; keep only those that actually improve something.
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

// ---------- Applying a decision ----------

export async function applyDecision(actor, projectId, { changes, note, source }) {
  await requirePlanning(actor, projectId);
  const state = await loadProjectState(actor, projectId);
  const next = applyChanges(state, changes); // validates everything BEFORE changing any data
  const before = evaluate(state);
  const predicted = evaluate(next);

  // Check every permission up front, so a decision is not left half-applied.
  if (changes.addMemberIds?.length) await projectsService.assertProjectPermission(actor, projectId, 'members.manage');
  if (changes.newTargetDate) await projectsService.assertProjectPermission(actor, projectId, 'projects.update');

  // Carry it out through the normal services: same checks, notifications and audit trail as
  // doing each step by hand.
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
}

const serializeChanges = (changes) => ({
  ...changes,
  ...(changes.newTargetDate ? { newTargetDate: changes.newTargetDate.toISOString() } : {}),
});

// ---------- The decision log ----------

// Decisions in the projects the actor manages, each with its effect so far: the risk and
// forecast when it was taken, what the model predicted, and where they are now.
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

  // The current state of each project involved (evaluated once per project).
  const now = new Date();
  const current = new Map();
  for (const pid of new Set(decisions.map((d) => d.projectId))) {
    try {
      current.set(pid, evaluate(await loadProjectState(actor, pid, now)));
    } catch {
      // project no longer accessible - leave its impact empty
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

// Decisions can only be recorded by applying them, but a manager may add a note afterwards.
export async function updateDecisionNote(actor, decisionId, note) {
  const decision = await prisma.decision.findFirst({ where: { id: decisionId, organizationId: actor.organizationId } });
  if (!decision) throw notFound('Decision not found');
  await requirePlanning(actor, decision.projectId);
  return prisma.decision.update({ where: { id: decisionId }, data: { note: note?.trim() || null } });
}
