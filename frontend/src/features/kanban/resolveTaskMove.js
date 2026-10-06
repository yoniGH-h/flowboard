// The decision behind KanbanBoardPage's onDragEnd: given the dragged task and the column it
// was dropped on, should a move actually be requested, and with what payload? Pulled out as
// a pure function so it's testable without needing to simulate a real dnd-kit pointer-sensor
// drag gesture through the DOM.
export function resolveTaskMove(tasks, activeId, overId) {
  if (!overId) return null;
  const task = tasks.find((t) => t.id === activeId);
  if (!task || task.columnId === overId) return null;
  return { taskId: task.id, columnId: overId };
}
