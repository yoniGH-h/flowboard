// ההחלטה אם גרירה היא הזזה.

// מחזיר את פרטי ההזזה, או null אם הכרטיס לא עבר עמודה.
export function resolveTaskMove(tasks, activeId, overId) {
  if (!overId) return null;
  const task = tasks.find((t) => t.id === activeId);
  if (!task || task.columnId === overId) return null;
  return { taskId: task.id, columnId: overId };
}
