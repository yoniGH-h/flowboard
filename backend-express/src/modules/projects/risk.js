// תפקיד הקובץ: ציון הסיכון לעיכוב של פרויקט (0 עד 100) מחמישה גורמים משוקללים.
// משתמשים בו: model.js, projects.service.js

// ציון סיכון לעיכוב של פרויקט (0 עד 100), מבוסס כללים ומוסבר, מחושב בזמן אמת מנתוני
// המשימות בכל קריאה - לא נשמר, ולכן אף פעם לא מתיישן.
//
// חמישה גורמים משוקללים, לכל אחד תקרה, כך שהסכום לא עובר 100:
//   משימות באיחור (0-30), משימות חסומות (0-20), עומס צוות (0-15),
//   זמן שנותר (0-20), התקדמות מול תכנון (0-15).
// הרמות תואמות ל-RiskBadge באתר: LOW עד 30, MEDIUM עד 60, HIGH מעל 60.

// חבר צוות עם יותר משימות פתוחות מזה נחשב מעל הקיבולת - אותו מספר כמו
// CAPACITY_TASKS במסך עומס הצוות.
// מעל כמה משימות פתוחות עובד נחשב עמוס (6).
// נקרא מ: model.js
export const WORKLOAD_CAPACITY_TASKS = 6;

const DAY_MS = 86_400_000;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// project:   { startDate, targetDate, progress }
// openTasks: [{ assigneeId, dueDate, blocked }]  (לא בארכיון ולא הושלמו)
// מחשב את ציון הסיכון, הרמה ופירוט הגורמים.
// נקרא מ: model.js, projects.service.js
export function calculateRisk(project, openTasks, memberCount, now = new Date()) {
  const openCount = openTasks.length;
  const overdueCount = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const blockedCount = openTasks.filter((t) => t.blocked).length;

  // 1. משימות באיחור - החלק מהמשימות הפתוחות שעברו את המועד שלהן.
  const overdueScore = openCount > 0 ? Math.round(Math.min(1, overdueCount / openCount) * 30) : 0;

  // 2. משימות חסומות - החלק מהמשימות הפתוחות שמסומנות כחסומות.
  const blockedScore = openCount > 0 ? Math.round(Math.min(1, blockedCount / openCount) * 20) : 0;

  // 3. עומס צוות - החלק מחברי הצוות שמחזיקים יותר מדי משימות פתוחות.
  const perAssignee = new Map();
  for (const t of openTasks) {
    if (t.assigneeId) perAssignee.set(t.assigneeId, (perAssignee.get(t.assigneeId) ?? 0) + 1);
  }
  const overCapacityCount = [...perAssignee.values()].filter((c) => c > WORKLOAD_CAPACITY_TASKS).length;
  const workloadScore = memberCount > 0 ? Math.round(Math.min(1, overCapacityCount / memberCount) * 15) : 0;

  // 4. זמן שנותר - כמה קרוב תאריך היעד.
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

  // 5. התקדמות מול תכנון - ההתקדמות בפועל מול המקום שבו קו ישר אומר שהיא אמורה להיות.
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
