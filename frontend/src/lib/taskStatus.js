// בדיקות מועד של משימה.

// האם המשימה באיחור.
export function isOverdue(task) {
  if (!task.dueDate || task.completedAt) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

// האם המועד של המשימה מתקרב.
export function isDueSoon(task, withinDays = 3) {
  if (!task.dueDate || task.completedAt) return false;
  const due = new Date(task.dueDate).getTime();
  const diffDays = (due - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}
