// תפקיד הקובץ: ההחלטה אם גרירה צריכה לשלוח בקשת הזזה.
// משתמשים בו: KanbanBoardPage.jsx, resolveTaskMove.test.js

// The decision behind KanbanBoardPage's onDragEnd: given the dragged task and the column it
// was dropped on, should a move actually be requested, and with what payload? Pulled out as
// a pure function so it's testable without needing to simulate a real dnd-kit pointer-sensor
// drag gesture through the DOM.
// מחזיר את פרטי ההזזה, או null אם הכרטיס לא עבר עמודה.
// נקרא מ: KanbanBoardPage.jsx, resolveTaskMove.test.js
export function resolveTaskMove(tasks, activeId, overId) {
  if (!overId) return null;
  const task = tasks.find((t) => t.id === activeId);
  if (!task || task.columnId === overId) return null;
  return { taskId: task.id, columnId: overId };
}
