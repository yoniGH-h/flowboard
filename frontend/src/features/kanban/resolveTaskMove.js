// תפקיד הקובץ: ההחלטה אם גרירה צריכה לשלוח בקשת הזזה.
// משתמשים בו: KanbanBoardPage.jsx, resolveTaskMove.test.js

// ההחלטה שמאחורי onDragEnd ב-KanbanBoardPage: בהינתן המשימה שנגררה והעמודה
// שעליה שוחררה, האם באמת צריך לבקש הזזה, ועם אילו נתונים? הוצאה
// לפונקציה טהורה כדי שאפשר יהיה לבדוק אותה בלי לדמות גרירה אמיתית
// של dnd-kit בדפדפן.
// מחזיר את פרטי ההזזה, או null אם הכרטיס לא עבר עמודה.
// נקרא מ: KanbanBoardPage.jsx, resolveTaskMove.test.js
export function resolveTaskMove(tasks, activeId, overId) {
  if (!overId) return null;
  const task = tasks.find((t) => t.id === activeId);
  if (!task || task.columnId === overId) return null;
  return { taskId: task.id, columnId: overId };
}
