// תפקיד הקובץ: זיהוי המשתמש לפי האסימון, ובדיקות הרשאה ברמת הנתיב.
// משתמשים בו: app.js, audit-log.routes.js, auth.routes.js, automation-rules.routes.js +10

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { PERMISSION_KEYS } from '../permissions/catalog.js';
import { effectivePermissions } from '../permissions/effective.js';
import { forbidden, unauthorized } from '../utils/httpError.js';
import { highestRoleLevel, ROLE_LEVEL } from '../utils/permissions.js';

// Loads the signed-in user from an access token. Returns the same object that every
// service receives as `actor`:
//   { userId, organizationId, email, roles, permissions }
// `permissions` is a Set of permission keys - role defaults + the organization's changes +
// the user's personal exceptions (see permissions/effective.js).
// Used by both the HTTP middleware below and the Socket.IO connection handler.
// מאמת אסימון גישה, טוען את המשתמש ומחשב את ההרשאות שלו.
// נקרא מ: socket.js
export async function authenticateAccessToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw unauthorized('Unauthorized');
  }

  // Loaded fresh on every request, so suspending a user or changing their permissions takes
  // effect immediately rather than when their access token expires.
  const [user, orgChanges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } }, permissionOverrides: true },
    }),
    prisma.organizationRolePermission.findMany({ where: { organizationId: payload.organizationId } }),
  ]);
  if (!user || user.status !== 'ACTIVE' || user.organizationId !== payload.organizationId) {
    throw unauthorized('Account is no longer active');
  }

  const roles = user.roles.map((userRole) => userRole.role.name);
  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    roles,
    permissions: effectivePermissions(roles, { orgChanges, userOverrides: user.permissionOverrides }),
  };
}

// Every /api route goes through this except the public ones (see app.js).
// On success the user is available as `req.user`.
// חוסם בקשה בלי אסימון תקף, ושם את המשתמש ב-req.user.
// נקרא מ: app.js, auth.routes.js
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Unauthorized');
  }
  req.user = await authenticateAccessToken(header.slice('Bearer '.length));
  next();
}

// Usage:  router.get('/', requirePermission('audit.view'), handler)
// For organization-wide permissions. Project-scoped permissions (tasks.manage, ...) are
// checked inside the services, because they also depend on WHICH project it is
// (see assertProjectPermission in modules/projects/projects.service.js).
// יוצר middleware שמחזיר 403 למי שאין לו את ההרשאה.
// נקרא מ: audit-log.routes.js, automation-rules.routes.js, insights.routes.js, meetings.routes.js +7
export function requirePermission(key) {
  if (!PERMISSION_KEYS.has(key)) throw new Error(`Unknown permission "${key}"`); // catches typos at startup
  return (req, _res, next) => {
    if (!req.user?.permissions.has(key)) {
      throw forbidden('You do not have permission to perform this action');
    }
    next();
  };
}

// Usage:  router.get('/', requireRole('SYSTEM_ADMIN'), handler)
// Allows that role and every role above it (Employee < PM < Org Admin < System Admin).
// Still used for things tied to a role itself rather than a changeable permission.
// יוצר middleware שמתיר רק מדרג מסוים ומעלה.
// נקרא מ: הקובץ הזה בלבד
export function requireRole(role) {
  const minLevel = ROLE_LEVEL[role];
  return (req, _res, next) => {
    if (!req.user || highestRoleLevel(req.user.roles) < minLevel) {
      throw forbidden('You do not have permission to perform this action');
    }
    next();
  };
}
