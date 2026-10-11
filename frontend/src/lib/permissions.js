// תפקיד הקובץ: בדיקות הרשאה בצד האתר, להצגה והסתרה של כפתורים.
// משתמשים בו: App.jsx, ProtectedRoute.jsx, ProtectedRoute.test.jsx, ContactButtons.jsx +10

// המספר של כל דרג: עובד 1 עד מנהל מערכת 4.
// נקרא מ: App.jsx, ProtectedRoute.jsx, ProtectedRoute.test.jsx, RolesPermissionsPage.jsx +3
export const ROLE_LEVEL = {
  EMPLOYEE: 1,
  PROJECT_MANAGER: 2,
  ORG_ADMIN: 3,
  SYSTEM_ADMIN: 4,
};

// האם התפקיד בדרג הנדרש ומעלה.
// נקרא מ: הקובץ הזה בלבד
export function hasAtLeastLevel(role, minLevel) {
  return ROLE_LEVEL[role] >= minLevel;
}

// האם התפקיד הוא מנהל פרויקט ומעלה.
// נקרא מ: MyProjectsPage.jsx
export function isManager(role) {
  return hasAtLeastLevel(role, ROLE_LEVEL.PROJECT_MANAGER);
}

// האם המשתמש הנוכחי רשאי לנהל את הפרויקט הזה? השרת מחליט לכל פרויקט
// (project.canManage: מנהל ארגון מנהל כל פרויקט, מנהל פרויקט רק את שלו),
// וגם התפקיד הפעיל חייב להיות תפקיד ניהולי, כך שמעבר ל-"Employee" מסתיר את
// אמצעי הניהול.
// האם המשתמש רשאי לנהל את הפרויקט הזה.
// נקרא מ: אין שימוש כרגע
export function canManageProject(role, project) {
  return isManager(role) && !!project?.canManage;
}

// האם למשתמש המחובר יש את ההרשאה הזו? user.permissions מגיע מ-/users/me
// (ברירות המחדל של התפקיד + שינויי הארגון + חריגים אישיים).
// האם למשתמש יש הרשאה מסוימת.
// נקרא מ: ContactButtons.jsx, ProjectManagementPage.jsx
export function hasPermission(user, key) {
  return !!user?.permissions?.includes(key);
}

// יכולות ברמת הפרויקט, מחושבות בשרת לכל פרויקט (project.can):
//   update, manageMembers, configureBoard, manageTasks, moderate  -> ניהול הפרויקט
//   createTasks, moveOwnTasks, comment, upload                     -> עבודה בפרויקט
// יכולות ניהול דורשות גם תפקיד פעיל ניהולי, כך ש"צפייה כעובד" מסתירה אותן.
const MANAGING_ABILITIES = new Set(['update', 'manageMembers', 'configureBoard', 'manageTasks', 'moderate']);

// האם למשתמש יש יכולת מסוימת בפרויקט (לפי מה שהשרת שלח).
// נקרא מ: KanbanBoardPage.jsx, ProjectOverviewPage.jsx, TaskDetailsPage.jsx
export function projectAbility(role, project, ability) {
  if (!project) return false;
  const managing = MANAGING_ABILITIES.has(ability);
  return project.can?.[ability] === true && (!managing || isManager(role));
}

// האם התפקיד הוא מנהל ארגון ומעלה.
// נקרא מ: ProjectFormDialog.jsx, ProjectManagementPage.jsx
export function isOrgAdmin(role) {
  return hasAtLeastLevel(role, ROLE_LEVEL.ORG_ADMIN);
}

// האם התפקיד הוא מנהל מערכת.
// נקרא מ: אין שימוש כרגע
export function isSystemAdmin(role) {
  return role === 'SYSTEM_ADMIN';
}

// איפה הרשאה חלה (ה-scope של כל הרשאה בקטלוג של השרת).
// השם המוצג של כל היקף הרשאה.
// נקרא מ: RolesPermissionsPage.jsx, UserPermissionsDialog.jsx
export const SCOPE_LABELS = {
  organization: 'Organization-wide',
  'managed-project': 'Projects they manage',
  'member-project': 'Projects they belong to',
  system: 'Platform',
};
