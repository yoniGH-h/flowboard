// רישום מעברים של משימה בין עמודות.

import { prisma } from '../../db.js';

// רושם שמשימה נכנסה לעמודה בלוח (TaskStatusChange). נקרא כשמשימה
// נוצרת (fromColumn = null), מוזזת בלוח, או מוזזת על ידי חוק אוטומציה.
// התובנות משתמשות בהיסטוריה הזו כדי למדוד כמה זמן עבודה ממתינה בכל שלב.
// רושם כניסה של משימה לעמודה (בסיס לניתוח צווארי בקבוק).
// נקרא מ: automation-rules.service.js, tasks.service.js
export function recordStatusChange({ taskId, projectId, fromColumn, toColumn, actorId }) {
  return prisma.taskStatusChange.create({
    data: {
      taskId,
      projectId,
      fromColumnName: fromColumn?.name ?? null,
      toColumnName: toColumn.name,
      toCategory: toColumn.category,
      actorId: actorId ?? null,
    },
  });
}
