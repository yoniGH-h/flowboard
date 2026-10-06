import { prisma } from '../../db.js';

// Records that a task entered a board column (TaskStatusChange). Called when a task is
// created (fromColumn = null), moved on the board, or moved by an automation rule.
// The insights use this history to measure how long work waits in each stage.
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
