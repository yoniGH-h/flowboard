// תפקיד הקובץ: מחשב תובנות למנהל מתוך הנתונים הקיימים: צפי, צווארי בקבוק ומגמת סיכון.
// משתמשים בו: insights.routes.js

// Insights: conclusions a manager can act on, computed from data FlowBoard already collects.
//
//   1. Delivery forecast  - at the pace of the last 4 weeks, when will each project finish,
//                           and how does that compare with its target date?
//   2. Estimate accuracy  - completed tasks' actual hours vs. estimated hours.
//   3. Where work waits   - how long tasks stay in each board stage (TaskStatusChange history),
//                           and which open tasks have been stuck the longest.
//   4. Risk trend         - projects whose delay risk rose sharply (ProjectRiskSnapshot).
//
// Everything is scoped to the projects the caller MANAGES (an Org Admin: the whole org).
// Each section is turned into plain-language `conclusions`, e.g.
//   "At the current pace, Billing Platform Migration will finish around Dec 2 - 20 days late."
import { prisma } from '../../db.js';
import { assertProjectPermission, managedProjectsWhere } from '../projects/projects.service.js';

const DAY_MS = 86_400_000;
const THROUGHPUT_WINDOW_DAYS = 28; // "current pace" = tasks completed in the last 4 weeks
const MIN_ESTIMATE_SAMPLE = 3; // don't draw conclusions from 1-2 tasks
const MIN_PACE_SAMPLE = 3; // fewer completed tasks than this = too little data for a forecast date
const STUCK_AFTER_DAYS = 7; // an active task in one stage longer than this counts as stuck
const ACTIVE_CATEGORIES = new Set(['IN_PROGRESS', 'REVIEW']); // stages where work should be moving
const CATEGORY_ORDER = { TODO: 0, IN_PROGRESS: 1, REVIEW: 2, DONE: 3 };

const days = (ms) => ms / DAY_MS;
const round1 = (n) => Math.round(n * 10) / 10;
const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// מחזיר את כל התובנות של פרויקט אחד.
// נקרא מ: insights.routes.js
export async function getInsights(actor, projectId) {
  if (projectId) await assertProjectPermission(actor, projectId, 'tasks.manage');

  const projects = await prisma.project.findMany({
    where: { ...managedProjectsWhere(actor), archived: false, ...(projectId ? { id: projectId } : {}) },
    select: { id: true, name: true, targetDate: true, status: true },
    orderBy: { targetDate: 'asc' },
  });
  const projectIds = projects.map((p) => p.id);
  const now = new Date();

  const [forecast, estimates, bottlenecks, riskTrends] = await Promise.all([
    deliveryForecast(projects, now),
    estimateAccuracy(projectIds),
    whereWorkWaits(projectIds, now),
    riskTrend(projects, now),
  ]);

  return {
    generatedAt: now,
    forecast,
    estimates,
    bottlenecks,
    riskTrends,
    conclusions: buildConclusions({ forecast, estimates, bottlenecks, riskTrends }),
  };
}

// ---------- 1. Delivery forecast ----------

async function deliveryForecast(projects, now) {
  const ids = projects.map((p) => p.id);
  const since = new Date(now.getTime() - THROUGHPUT_WINDOW_DAYS * DAY_MS);

  const [openRows, doneRows] = await Promise.all([
    prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, archived: false, completedAt: null },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, archived: false, completedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const openBy = new Map(openRows.map((r) => [r.projectId, r._count._all]));
  const doneBy = new Map(doneRows.map((r) => [r.projectId, r._count._all]));

  return projects.map((p) => {
    const open = openBy.get(p.id) ?? 0;
    const doneRecently = doneBy.get(p.id) ?? 0;
    const base = { projectId: p.id, name: p.name, targetDate: p.targetDate, openTasks: open, completedLast4Weeks: doneRecently };

    if (open === 0) return { ...base, status: 'done', forecastDate: null, daysLate: null };
    if (doneRecently === 0) return { ...base, status: 'stalled', forecastDate: null, daysLate: null };

    // Remaining work / recent pace = days still needed.
    const perDay = doneRecently / THROUGHPUT_WINDOW_DAYS;
    const forecastDate = new Date(now.getTime() + Math.ceil(open / perDay) * DAY_MS);
    const daysLate = Math.round(days(forecastDate - p.targetDate));
    // With only 1-2 completed tasks the "pace" is noise - report that it's too slow, but don't
    // pretend to know the finish date.
    const confident = doneRecently >= MIN_PACE_SAMPLE;
    return {
      ...base,
      weeklyPace: round1(perDay * 7),
      forecastDate: confident ? forecastDate : null,
      daysLate: confident ? daysLate : null,
      status: !confident ? (daysLate > 0 ? 'slow' : 'on-track') : daysLate > 0 ? 'late' : 'on-track',
    };
  });
}

// ---------- 2. Estimate accuracy ----------

async function estimateAccuracy(projectIds) {
  const where = {
    projectId: { in: projectIds },
    completedAt: { not: null },
    estimatedHours: { gt: 0 },
    actualHours: { gt: 0 },
  };
  const [totals, byAssignee] = await Promise.all([
    prisma.task.aggregate({ where, _sum: { estimatedHours: true, actualHours: true }, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { ...where, assigneeId: { not: null } },
      _sum: { estimatedHours: true, actualHours: true },
      _count: { _all: true },
    }),
  ]);

  const estimated = totals._sum.estimatedHours ?? 0;
  const actual = totals._sum.actualHours ?? 0;
  return {
    sampleSize: totals._count._all,
    estimatedHours: round1(estimated),
    actualHours: round1(actual),
    // 1.25 = work took 25% longer than estimated; 0.8 = 20% shorter.
    ratio: estimated > 0 ? Math.round((actual / estimated) * 100) / 100 : null,
    byAssignee: byAssignee
      .map((r) => ({
        userId: r.assigneeId,
        tasks: r._count._all,
        estimatedHours: round1(r._sum.estimatedHours ?? 0),
        actualHours: round1(r._sum.actualHours ?? 0),
        ratio: r._sum.estimatedHours ? Math.round((r._sum.actualHours / r._sum.estimatedHours) * 100) / 100 : null,
      }))
      .sort((a, b) => b.tasks - a.tasks),
  };
}

// ---------- 3. Where work waits ----------

async function whereWorkWaits(projectIds, now) {
  const changes = await prisma.taskStatusChange.findMany({
    where: { projectId: { in: projectIds }, task: { archived: false } },
    orderBy: [{ taskId: 'asc' }, { changedAt: 'asc' }],
    include: {
      task: {
        select: { id: true, title: true, completedAt: true, assigneeId: true, project: { select: { id: true, name: true } } },
      },
    },
  });

  // Group the history by task: [enter column A, enter column B, ...]
  const byTask = new Map();
  for (const c of changes) {
    if (!byTask.has(c.taskId)) byTask.set(c.taskId, []);
    byTask.get(c.taskId).push(c);
  }

  const stages = new Map(); // column name -> { category, totalDays, visits }
  const stuck = [];
  for (const visits of byTask.values()) {
    visits.forEach((visit, i) => {
      const next = visits[i + 1];
      if (next) {
        // A finished stay: from entering this column until entering the next one.
        const stage = stages.get(visit.toColumnName) ?? { category: visit.toCategory, totalDays: 0, visits: 0 };
        stage.totalDays += days(next.changedAt - visit.changedAt);
        stage.visits += 1;
        stages.set(visit.toColumnName, stage);
      } else if (!visit.task.completedAt && ACTIVE_CATEGORIES.has(visit.toCategory)) {
        // The task is still in this (active) column - how long has it been waiting?
        const waiting = days(now - visit.changedAt);
        if (waiting >= STUCK_AFTER_DAYS) {
          stuck.push({
            taskId: visit.task.id,
            title: visit.task.title,
            projectId: visit.task.project.id,
            projectName: visit.task.project.name,
            assigneeId: visit.task.assigneeId,
            column: visit.toColumnName,
            daysInColumn: Math.floor(waiting),
          });
        }
      }
    });
  }

  const stageList = [...stages.entries()]
    .filter(([, s]) => s.category !== 'DONE')
    .map(([name, s]) => ({ name, category: s.category, avgDays: round1(s.totalDays / s.visits), visits: s.visits }))
    .sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.name.localeCompare(b.name));

  // The bottleneck = the active stage (in progress / review) where work waits longest.
  const bottleneck = stageList
    .filter((s) => ACTIVE_CATEGORIES.has(s.category) && s.visits >= 2)
    .sort((a, b) => b.avgDays - a.avgDays)[0] ?? null;

  return {
    stages: stageList,
    bottleneck,
    stuckTasks: stuck.sort((a, b) => b.daysInColumn - a.daysInColumn).slice(0, 8),
    stuckCount: stuck.length,
  };
}

// ---------- 4. Risk trend ----------

async function riskTrend(projects, now) {
  const since = new Date(now.getTime() - 14 * DAY_MS);
  const snapshots = await prisma.projectRiskSnapshot.findMany({
    where: { projectId: { in: projects.map((p) => p.id) }, day: { gte: since } },
    orderBy: { day: 'asc' },
  });
  return projects
    .map((p) => {
      const own = snapshots.filter((s) => s.projectId === p.id);
      if (own.length < 2) return null;
      const first = own[0];
      const last = own.at(-1);
      return { projectId: p.id, name: p.name, from: first.riskScore, to: last.riskScore, change: last.riskScore - first.riskScore, since: first.day };
    })
    .filter(Boolean);
}

// ---------- Plain-language conclusions ----------

function buildConclusions({ forecast, estimates, bottlenecks, riskTrends }) {
  const out = [];

  for (const f of forecast) {
    if (f.status === 'late') {
      out.push({
        severity: f.daysLate > 14 ? 'critical' : 'warning',
        area: 'forecast',
        projectId: f.projectId,
        text: `At the current pace (${f.weeklyPace} tasks/week), ${f.name} will finish around ${shortDate(f.forecastDate)} - ${plural(f.daysLate, 'day')} after its target date.`,
      });
    } else if (f.status === 'slow') {
      out.push({
        severity: 'warning',
        area: 'forecast',
        projectId: f.projectId,
        text: `${f.name}: only ${plural(f.completedLast4Weeks, 'task')} completed in the last 4 weeks, with ${f.openTasks} still open - at this pace it will miss its ${shortDate(f.targetDate)} target.`,
      });
    } else if (f.status === 'stalled') {
      out.push({
        severity: 'critical',
        area: 'forecast',
        projectId: f.projectId,
        text: `${f.name} has ${plural(f.openTasks, 'open task')} but nothing was completed in the last 4 weeks.`,
      });
    }
  }

  for (const r of riskTrends) {
    if (r.change >= 15) {
      out.push({
        severity: 'warning',
        area: 'risk',
        projectId: r.projectId,
        text: `${r.name}'s delay risk rose from ${r.from} to ${r.to} in the last two weeks.`,
      });
    }
  }

  if (bottlenecks.bottleneck) {
    const b = bottlenecks.bottleneck;
    out.push({
      severity: b.avgDays >= 5 ? 'warning' : 'info',
      area: 'bottleneck',
      text: `Work waits longest in "${b.name}": ${b.avgDays} days on average - the slowest active stage.`,
    });
  }
  if (bottlenecks.stuckCount > 0) {
    out.push({
      severity: 'warning',
      area: 'bottleneck',
      text: `${plural(bottlenecks.stuckCount, 'task')} ${bottlenecks.stuckCount === 1 ? 'has' : 'have'} been sitting in an active stage for over ${STUCK_AFTER_DAYS} days.`,
    });
  }

  if (estimates.sampleSize >= MIN_ESTIMATE_SAMPLE && estimates.ratio) {
    const pct = Math.round(Math.abs(estimates.ratio - 1) * 100);
    const basis = `(${plural(estimates.sampleSize, 'completed task')})`;
    if (estimates.ratio > 1.15) {
      out.push({ severity: 'warning', area: 'estimates', text: `The team underestimates: tasks take ${pct}% longer than estimated ${basis}. Plan with extra buffer.` });
    } else if (estimates.ratio < 0.85) {
      out.push({ severity: 'info', area: 'estimates', text: `The team overestimates: tasks take ${pct}% less time than estimated ${basis}.` });
    } else {
      out.push({ severity: 'info', area: 'estimates', text: `Estimates are reliable - actual time is within ${pct}% of the estimate ${basis}.` });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
