// דרגי התפקידים.

// המספר של כל דרג: עובד 1 עד מנהל מערכת 4.
export const ROLE_LEVEL = {
  EMPLOYEE: 1,
  PROJECT_MANAGER: 2,
  ORG_ADMIN: 3,
  SYSTEM_ADMIN: 4,
};

// מחזיר את הדרג הגבוה ביותר מבין תפקידי המשתמש.
export function highestRoleLevel(roles) {
  return roles.reduce((max, role) => Math.max(max, ROLE_LEVEL[role] ?? 0), 0);
}

// האם המשתמש מנהל פרויקט ומעלה.
export function isManager(user) {
  return highestRoleLevel(user.roles) >= ROLE_LEVEL.PROJECT_MANAGER;
}

// האם המשתמש מנהל ארגון ומעלה.
export function isOrgAdmin(user) {
  return highestRoleLevel(user.roles) >= ROLE_LEVEL.ORG_ADMIN;
}
