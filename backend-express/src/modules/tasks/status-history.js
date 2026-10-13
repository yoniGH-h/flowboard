// רישום מעברים של משימה בין עמודות.

import { prisma } from '../../db.js';

// רושם כניסה של משימה לעמודה (בסיס לניתוח צווארי בקבוק).
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
