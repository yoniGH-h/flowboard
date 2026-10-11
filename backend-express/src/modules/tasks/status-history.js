// תפקיד הקובץ: רישום המעברים של משימה בין עמודות.
// משתמשים בו: automation-rules.service.js, tasks.service.js

import { prisma } from '../../db.js';

// Records that a task entered a board column (TaskStatusChange). Called when a task is
// created (fromColumn = null), moved on the board, or moved by an automation rule.
// The insights use this history to measure how long work waits in each stage.
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
