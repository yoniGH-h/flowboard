// Shared overdue/due-soon logic evaluated against the real current
// time, so every screen uses a consistent clock.
// wired to real task data.
export function isOverdue(task) {
  if (!task.dueDate || task.completedAt) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function isDueSoon(task, withinDays = 3) {
  if (!task.dueDate || task.completedAt) return false;
  const due = new Date(task.dueDate).getTime();
  const diffDays = (due - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}
