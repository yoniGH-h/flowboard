// תפקיד הקובץ: בדיקות מועד של משימה.
// משתמשים בו: TaskRow.jsx, PersonalDashboardPage.jsx, KanbanBoardPage.jsx, KanbanTaskCard.jsx +2

// לוגיקה משותפת של "באיחור" ו"מועד מתקרב", מחושבת מול השעה האמיתית
// הנוכחית, כך שכל המסכים משתמשים באותו שעון
// ובנתוני המשימות האמיתיים.
// האם המשימה באיחור.
// נקרא מ: TaskRow.jsx, PersonalDashboardPage.jsx, KanbanBoardPage.jsx, KanbanTaskCard.jsx +2
export function isOverdue(task) {
  if (!task.dueDate || task.completedAt) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

// האם המועד של המשימה מתקרב.
// נקרא מ: PersonalDashboardPage.jsx, MyTasksPage.jsx
export function isDueSoon(task, withinDays = 3) {
  if (!task.dueDate || task.completedAt) return false;
  const due = new Date(task.dueDate).getTime();
  const diffDays = (due - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}
