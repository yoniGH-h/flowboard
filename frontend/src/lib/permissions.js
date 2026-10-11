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

// May the current user manage this particular project? The server decides per project
// (`project.canManage`: Org Admins manage every project, Project Managers only their own),
// and the active role must be a manager role too, so switching to "Employee" hides the
// management controls.
// האם המשתמש רשאי לנהל את הפרויקט הזה.
// נקרא מ: אין שימוש כרגע
export function canManageProject(role, project) {
  return isManager(role) && !!project?.canManage;
}

// Does the signed-in user have this permission? `user.permissions` comes from /users/me
// (role defaults + organization changes + personal exceptions).
// האם למשתמש יש הרשאה מסוימת.
// נקרא מ: ContactButtons.jsx, ProjectManagementPage.jsx
export function hasPermission(user, key) {
  return !!user?.permissions?.includes(key);
}

// Project-level abilities, computed by the server per project (`project.can`):
//   update, manageMembers, configureBoard, manageTasks, moderate  -> managing the project
//   createTasks, moveOwnTasks, comment, upload                     -> working in the project
// Managing abilities also need a manager active role, so "view as Employee" hides them.
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

// Where a permission applies (the `scope` of each permission in the server's catalog).
// השם המוצג של כל היקף הרשאה.
// נקרא מ: RolesPermissionsPage.jsx, UserPermissionsDialog.jsx
export const SCOPE_LABELS = {
  organization: 'Organization-wide',
  'managed-project': 'Projects they manage',
  'member-project': 'Projects they belong to',
  system: 'Platform',
};
