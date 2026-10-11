// תפקיד הקובץ: בדיקות יחידה להחלטת ההזזה.
// משתמשים בו: מורץ על ידי Vitest (npm test)

import { describe, expect, it } from 'vitest';
import { resolveTaskMove } from './resolveTaskMove';

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    projectId: 'project-1',
    columnId: 'col-todo',
    title: 'Draft schema',
    description: '',
    assigneeId: null,
    creatorId: 'user-1',
    priority: 'MEDIUM',
    startDate: null,
    dueDate: null,
    estimatedHours: null,
    actualHours: null,
    labelIds: [],
    dependencies: [],
    blocked: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

// ב-KanbanBoardPage.handleDragEnd אין עדכון אופטימי ואין ביטול
// - קודם מחליטים ואז שולחים. כאן נבדק חלק ההחלטה:
// האם שחרור צריך להפעיל הזזה, ועם אילו נתונים.
describe('resolveTaskMove', () => {
  it('returns the move payload when the task is dropped on a different column', () => {
    const tasks = [makeTask({ id: 'task-1', columnId: 'col-todo' })];

    expect(resolveTaskMove(tasks, 'task-1', 'col-in-progress')).toEqual({
      taskId: 'task-1',
      columnId: 'col-in-progress',
    });
  });

  it('returns null when dropped back on its own column (no-op drag)', () => {
    const tasks = [makeTask({ id: 'task-1', columnId: 'col-todo' })];

    expect(resolveTaskMove(tasks, 'task-1', 'col-todo')).toBeNull();
  });

  it('returns null when the drag has no drop target (dropped outside any column)', () => {
    const tasks = [makeTask({ id: 'task-1', columnId: 'col-todo' })];

    expect(resolveTaskMove(tasks, 'task-1', null)).toBeNull();
  });

  it('returns null when the dragged id does not match any known task', () => {
    const tasks = [makeTask({ id: 'task-1', columnId: 'col-todo' })];

    expect(resolveTaskMove(tasks, 'task-does-not-exist', 'col-in-progress')).toBeNull();
  });
});
