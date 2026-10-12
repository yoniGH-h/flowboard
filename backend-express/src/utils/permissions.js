// דרגי התפקידים.

// ארבעת דרגי התפקידים. זהה ל-frontend/src/lib/permissions.js - יש לשמור על שניהם מסונכרנים.
// המספר של כל דרג: עובד 1 עד מנהל מערכת 4.
// נקרא מ: auth.js, users.service.js
export const ROLE_LEVEL = {
  EMPLOYEE: 1,
  PROJECT_MANAGER: 2,
  ORG_ADMIN: 3,
  SYSTEM_ADMIN: 4,
};

// מחזיר את הדרג הגבוה ביותר מבין תפקידי המשתמש.
// נקרא מ: auth.js, permissions.service.js
export function highestRoleLevel(roles) {
  return roles.reduce((max, role) => Math.max(max, ROLE_LEVEL[role] ?? 0), 0);
}

// מחזיק בתפקיד מנהל פרויקט ומעלה. זה לבדו לא אומר שהמשתמש רשאי
// לנהל פרויקט מסוים - מנהל פרויקט שולט רק בפרויקטים שהוא מנהל
// (ראו managesProject בקובץ modules/projects/projects.service.js).
// האם המשתמש מנהל פרויקט ומעלה.
// נקרא מ: permissions.service.js, projects.service.js
export function isManager(user) {
  return highestRoleLevel(user.roles) >= ROLE_LEVEL.PROJECT_MANAGER;
}

// מנהל ארגון ומעלה: שולט בכל הפרויקטים בארגון.
// האם המשתמש מנהל ארגון ומעלה.
// נקרא מ: projects.service.js
export function isOrgAdmin(user) {
  return highestRoleLevel(user.roles) >= ROLE_LEVEL.ORG_ADMIN;
}
