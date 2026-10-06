// Explainable, rules-based project delay-risk score (0-100), computed live from real task
// data on every read - never stored, so it can never go stale.
//
// Five weighted factors, each capped so the total can never exceed 100:
//   overdue tasks (0-30), blocked tasks (0-20), team workload (0-15),
//   remaining time (0-20), progress vs. plan (0-15).
// Levels match RiskBadge on the frontend: LOW <= 30, MEDIUM <= 60, HIGH > 60.

// A member with more open tasks than this counts as over capacity - same number as
// CAPACITY_TASKS on the Team Workload screen.
export const WORKLOAD_CAPACITY_TASKS = 6;

const DAY_MS = 86_400_000;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// project:   { startDate, targetDate, progress }
// openTasks: [{ assigneeId, dueDate, blocked }]  (not archived, not completed)
export function calculateRisk(project, openTasks, memberCount, now = new Date()) {
  const openCount = openTasks.length;
  const overdueCount = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const blockedCount = openTasks.filter((t) => t.blocked).length;

  // 1. Overdue tasks - share of open tasks past their due date.
  const overdueScore = openCount > 0 ? Math.round(Math.min(1, overdueCount / openCount) * 30) : 0;

  // 2. Blocked tasks - share of open tasks marked blocked.
  const blockedScore = openCount > 0 ? Math.round(Math.min(1, blockedCount / openCount) * 20) : 0;

  // 3. Team workload - share of members holding too many open tasks.
  const perAssignee = new Map();
  for (const t of openTasks) {
    if (t.assigneeId) perAssignee.set(t.assigneeId, (perAssignee.get(t.assigneeId) ?? 0) + 1);
  }
  const overCapacityCount = [...perAssignee.values()].filter((c) => c > WORKLOAD_CAPACITY_TASKS).length;
  const workloadScore = memberCount > 0 ? Math.round(Math.min(1, overCapacityCount / memberCount) * 15) : 0;

  // 4. Remaining time - how close the target date is.
  const totalDays = Math.max(1, Math.round((project.targetDate - project.startDate) / DAY_MS));
  const daysRemaining = Math.round((project.targetDate - now) / DAY_MS);
  const percentRemaining = daysRemaining / totalDays;
  const complete = project.progress >= 100;

  let timeScore = 0;
  if (!complete) {
    if (daysRemaining <= 0) timeScore = 20;
    else if (percentRemaining < 0.1) timeScore = 15;
    else if (percentRemaining < 0.25) timeScore = 10;
    else if (percentRemaining < 0.5) timeScore = 5;
  }

  // 5. Progress vs. plan - actual progress compared with where a straight line says it should be.
  const elapsedDays = totalDays - daysRemaining;
  const expectedProgress = Math.round(Math.min(1, Math.max(0, elapsedDays / totalDays)) * 100);
  const gap = expectedProgress - project.progress;

  let planScore = 0;
  if (!complete) {
    if (gap >= 25) planScore = 15;
    else if (gap >= 10) planScore = 8;
    else if (gap > 0) planScore = 4;
  }

  const riskScore = overdueScore + blockedScore + workloadScore + timeScore + planScore;
  const riskLevel = riskScore <= 30 ? 'LOW' : riskScore <= 60 ? 'MEDIUM' : 'HIGH';

  const riskFactors = [
    {
      label: 'Overdue tasks',
      contribution: overdueScore,
      detail:
        openCount > 0
          ? `${overdueCount} of ${plural(openCount, 'open task')} overdue (${Math.round((overdueCount / openCount) * 100)}%)`
          : 'No open tasks',
    },
    {
      label: 'Blocked tasks',
      contribution: blockedScore,
      detail:
        openCount > 0
          ? `${blockedCount} of ${plural(openCount, 'open task')} blocked (${Math.round((blockedCount / openCount) * 100)}%)`
          : 'No open tasks',
    },
    {
      label: 'Team workload',
      contribution: workloadScore,
      detail:
        memberCount > 0
          ? `${overCapacityCount} of ${plural(memberCount, 'member')} over ${WORKLOAD_CAPACITY_TASKS} open tasks`
          : 'No members assigned',
    },
    {
      label: 'Remaining time',
      contribution: timeScore,
      detail: complete
        ? 'Project complete'
        : daysRemaining <= 0
          ? `${plural(Math.abs(daysRemaining), 'day')} past target date`
          : `${plural(daysRemaining, 'day')} remaining`,
    },
    {
      label: 'Progress vs. plan',
      contribution: planScore,
      detail: complete
        ? 'Project complete'
        : gap > 0
          ? `Actual progress trailing planned pace by ~${plural(gap, 'point')}`
          : 'On or ahead of planned pace',
    },
  ];

  return { riskScore, riskLevel, riskFactors };
}
