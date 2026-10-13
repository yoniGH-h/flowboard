// בדיקות הרשאה בצד האתר.

// המספר של כל דרג: עובד 1 עד מנהל מערכת 4.
export const ROLE_LEVEL = {
  EMPLOYEE: 1,
  PROJECT_MANAGER: 2,
  ORG_ADMIN: 3,
  SYSTEM_ADMIN: 4,
};

// האם התפקיד בדרג הנדרש ומעלה.
export function hasAtLeastLevel(role, minLevel) {
  return ROLE_LEVEL[role] >= minLevel;
}

// האם התפקיד הוא מנהל פרויקט ומעלה.
export function isManager(role) {
  return hasAtLeastLevel(role, ROLE_LEVEL.PROJECT_MANAGER);
}

// האם המשתמש רשאי לנהל את הפרויקט הזה.
export function canManageProject(role, project) {
  return isManager(role) && !!project?.canManage;
}

// האם למשתמש יש הרשאה מסוימת.
export function hasPermission(user, key) {
  return !!user?.permissions?.includes(key);
}

// יכולות ברמת הפרויקט, מחושבות בשרת לכל פרויקט (project.can):
//   update, manageMembers, configureBoard, manageTasks, moderate  -> ניהול הפרויקט
//   createTasks, moveOwnTasks, comment, upload                     -> עבודה בפרויקט
// יכולות ניהול דורשות גם תפקיד פעיל ניהולי, כך ש"צפייה כעובד" מסתירה אותן.
const MANAGING_ABILITIES = new Set(['update', 'manageMembers', 'configureBoard', 'manageTasks', 'moderate']);

// האם למשתמש יש יכולת מסוימת בפרויקט (לפי מה שהשרת שלח).
export function projectAbility(role, project, ability) {
  if (!project) return false;
  const managing = MANAGING_ABILITIES.has(ability);
  return project.can?.[ability] === true && (!managing || isManager(role));
}

// האם התפקיד הוא מנהל ארגון ומעלה.
export function isOrgAdmin(role) {
  return hasAtLeastLevel(role, ROLE_LEVEL.ORG_ADMIN);
}

// האם התפקיד הוא מנהל מערכת.
export function isSystemAdmin(role) {
  return role === 'SYSTEM_ADMIN';
}

// השם המוצג של כל היקף הרשאה.
export const SCOPE_LABELS = {
  organization: 'Organization-wide',
  'managed-project': 'Projects they manage',
  'member-project': 'Projects they belong to',
  system: 'Platform',
};
