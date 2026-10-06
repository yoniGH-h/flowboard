// The four-level role hierarchy. Mirrors frontend/src/lib/permissions.js - keep the two in sync.
export const ROLE_LEVEL = {
  EMPLOYEE: 1,
  PROJECT_MANAGER: 2,
  ORG_ADMIN: 3,
  SYSTEM_ADMIN: 4,
};

export function highestRoleLevel(roles) {
  return roles.reduce((max, role) => Math.max(max, ROLE_LEVEL[role] ?? 0), 0);
}

// Holds the Project Manager role or above. On its own this does NOT mean the user may
// manage a given project - a Project Manager only controls the projects they manage
// (see managesProject in modules/projects/projects.service.js).
export function isManager(user) {
  return highestRoleLevel(user.roles) >= ROLE_LEVEL.PROJECT_MANAGER;
}

// Org Admin and above: controls every project in the organization.
export function isOrgAdmin(user) {
  return highestRoleLevel(user.roles) >= ROLE_LEVEL.ORG_ADMIN;
}
